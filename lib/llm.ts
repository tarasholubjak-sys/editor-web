/**
 * LLM клієнт — chain fallback Gemini → Anthropic → OpenAI
 */

import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

type Provider = "gemini" | "anthropic" | "openai";

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
    try {
      if (provider === "gemini" && process.env.GEMINI_API_KEY) {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const res = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: user }] }],
          config: { systemInstruction: system, maxOutputTokens: maxTokens },
        });
        const text = res.text || "";
        if (text) return { text, provider: "gemini" };
      }

      if (provider === "anthropic" && process.env.ANTHROPIC_API_KEY) {
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const res = await client.messages.create({
          model: "claude-haiku-4-5",
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content: user }],
        });
        const text = res.content
          .filter((b: any) => b.type === "text")
          .map((b: any) => b.text)
          .join("\n");
        if (text) return { text, provider: "anthropic" };
      }

      if (provider === "openai" && process.env.OPENAI_API_KEY) {
        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const res = await client.chat.completions.create({
          model: process.env.OPENAI_MODEL || "gpt-5.4-nano",
          max_completion_tokens: maxTokens,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        });
        const text = res.choices[0]?.message?.content || "";
        if (text) return { text, provider: "openai" };
      }
    } catch (err: any) {
      console.warn(`[llm] ${provider} fail: ${err?.message}`);
      lastError = err;
      continue;
    }
  }
  throw new Error(`Усі LLM провайдери не справились: ${lastError?.message || "?"}`);
}
