/**
 * LLM клієнт — chain fallback Gemini → Anthropic → OpenAI
 *
 * Покращення (P1 audit):
 *  - 1 retry на провайдера при transient помилках (timeout, 5xx, 429)
 *  - exponential backoff 800ms → 2400ms
 *  - дефолтна модель OpenAI: gpt-4o-mini (gpt-5.4-nano не існує)
 */

import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

type Provider = "gemini" | "anthropic" | "openai";

function isTransientError(err: any): boolean {
  const status = err?.status || err?.response?.status;
  if (status === 408 || status === 429 || (status >= 500 && status < 600)) return true;
  const msg = String(err?.message || "").toLowerCase();
  return /timeout|timed out|econnreset|enotfound|fetch failed|socket hang up/.test(msg);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function callGemini(system: string, user: string, maxTokens: number): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const res = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: user }] }],
    config: { systemInstruction: system, maxOutputTokens: maxTokens },
  });
  return res.text || "";
}

async function callAnthropic(system: string, user: string, maxTokens: number): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const res = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5",
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  return res.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n");
}

async function callOpenAI(system: string, user: string, maxTokens: number): Promise<string> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const res = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    max_completion_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return res.choices[0]?.message?.content || "";
}

async function tryProvider(
  provider: Provider,
  system: string,
  user: string,
  maxTokens: number,
): Promise<string> {
  const fn =
    provider === "gemini" ? callGemini : provider === "anthropic" ? callAnthropic : callOpenAI;

  // 1 retry на transient помилку
  let lastErr: any;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await fn(system, user, maxTokens);
    } catch (err: any) {
      lastErr = err;
      if (attempt === 0 && isTransientError(err)) {
        await sleep(800);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

export async function llmGenerate({
  system,
  user,
  maxTokens = 6000,
  chain,
}: {
  system: string;
  user: string;
  maxTokens?: number;
  chain?: Provider[];
}): Promise<{ text: string; provider: Provider }> {
  const providers: Provider[] =
    chain && chain.length > 0
      ? chain
      : (process.env.LLM_CHAIN?.split(",").map((s) => s.trim() as Provider) || [
          "gemini",
          "anthropic",
          "openai",
        ]);

  let lastError: any = null;

  for (const provider of providers) {
    const hasKey =
      (provider === "gemini" && process.env.GEMINI_API_KEY) ||
      (provider === "anthropic" && process.env.ANTHROPIC_API_KEY) ||
      (provider === "openai" && process.env.OPENAI_API_KEY);
    if (!hasKey) continue;

    try {
      const text = await tryProvider(provider, system, user, maxTokens);
      if (text) return { text, provider };
    } catch (err: any) {
      console.warn(`[llm] ${provider} fail: ${err?.message}`);
      lastError = err;
      continue;
    }
  }
  throw new Error(`Усі LLM провайдери не справились: ${lastError?.message || "?"}`);
}
