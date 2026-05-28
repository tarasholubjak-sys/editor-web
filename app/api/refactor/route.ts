/**
 * POST /api/refactor
 *
 * Тіло: { rawText: string }
 * Відповідь: { markdown, type, duplicates?, recommendation? }
 */

import { NextRequest, NextResponse } from "next/server";
import { llmGenerate } from "@/lib/llm";
import { loadSkill, loadTemplate } from "@/lib/skill";
import { outlineSearch, buildPublicUrl } from "@/lib/outline";

export const runtime = "nodejs";
export const maxDuration = 60;

// Класифікація типу через швидкий LLM-виклик
async function classify(rawText: string): Promise<string> {
  const prompt = `Класифікуй документ Selfy за одним з типів:
- sop (Регламент / процес / алгоритм)
- script (Скрипт продажу / дзвінків / шаблон розмови)
- faq (FAQ — питання+відповідь)
- onboarding (Онбординг новачка)
- policy (Політика / правила компанії)
- product (Опис бренду / товару)

Текст:
${rawText.slice(0, 1500)}

Поверни ТІЛЬКИ одне слово з лапок (sop/script/faq/onboarding/policy/product). Без пояснень.`;

  try {
    const { text } = await llmGenerate({
      system: "Ти класифікатор документів.",
      user: prompt,
      maxTokens: 50,
    });
    const cleaned = text.trim().toLowerCase().replace(/[^a-z]/g, "");
    if (["sop", "script", "faq", "onboarding", "policy", "product"].includes(cleaned)) {
      return cleaned;
    }
  } catch {
    /* fallback */
  }
  return "sop";
}

// Витягуємо title з markdown (перший H1)
function extractTitle(md: string): string {
  const m = md.match(/^#\s+(.+?)$/m);
  return m ? m[1].trim() : "Без назви";
}

export async function POST(req: NextRequest) {
  try {
    const { rawText } = await req.json();
    if (!rawText || typeof rawText !== "string" || rawText.trim().length < 20) {
      return NextResponse.json({ error: "Текст занадто короткий (мінімум 20 символів)" }, { status: 400 });
    }

    const safeText = rawText.slice(0, 30000);

    // 1. Класифікувати
    const type = await classify(safeText);

    // 2. Завантажити скіл + шаблон
    const { systemPrompt } = loadSkill();
    const template = loadTemplate(type);

    // 3. Викликати LLM для refactor
    const userMessage = `СИРИЙ ТЕКСТ ДОКУМЕНТА (тип: ${type}):
${safeText}

ШАБЛОН ДЛЯ ЦЬОГО ТИПУ:
${template}

ЗАВДАННЯ:
1. Витягни суть зі сирого тексту.
2. Прибери шум (хаотичне форматування, англіцизми, "!!!!").
3. Застосуй шаблон.
4. Заповни шапку метаданими (поточна дата ${new Date().toISOString().slice(0, 10)}).
5. Доповни цінним: чек-листи, типові помилки, "як перевірити", шаблони фраз де доречно.
6. Дірки позначай '⚠️ Потрібно уточнити' — НЕ вигадуй фактів.
7. Використовуй Notice блоки (:::info, :::warning, :::tip, :::success), Mermaid для алгоритмів, таблиці для порівнянь.
8. НЕ роби блок "Зміст" — Outline сам генерує.

Поверни ТІЛЬКИ готовий markdown починаючи з H1. Без преамбули.`;

    const { text: markdown, provider } = await llmGenerate({
      system: systemPrompt,
      user: userMessage,
      maxTokens: 8000,
    });

    // 4. Перевірити дублі через Outline
    let duplicates: any[] = [];
    let recommendation = "";
    try {
      const title = extractTitle(markdown);
      const candidates = await outlineSearch(title, 5);
      duplicates = candidates
        .filter((c: any) => c?.document?.id)
        .map((c: any) => ({
          id: c.document.id,
          title: c.document.title,
          url: buildPublicUrl(c.document.url),
          matchScore: typeof c.ranking === "number" ? Math.min(c.ranking, 1) : 0.5,
        }))
        .slice(0, 3);

      if (duplicates.length > 0 && duplicates[0].matchScore > 0.6) {
        recommendation = `Висока ймовірність дубліката з "${duplicates[0].title}" — рекомендую оновити існуючу статтю замість створення нової.`;
      } else if (duplicates.length > 0) {
        recommendation = "Знайдено тематично схожі статті — перегляньте перед публікацією.";
      }
    } catch (err: any) {
      console.warn(`[refactor] dedup check failed: ${err.message}`);
    }

    return NextResponse.json({
      markdown,
      type,
      duplicates,
      recommendation,
      provider,
    });
  } catch (err: any) {
    console.error("[refactor] error:", err);
    return NextResponse.json({ error: err.message || "Невідома помилка" }, { status: 500 });
  }
}
