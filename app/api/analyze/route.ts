/**
 * POST /api/analyze
 *
 * Тіло: { markdown: string, duplicates?: any[], type?: string }
 * Відповідь: { analysis: AnalysisResult }
 *
 * AI-аналіз нової статті:
 *  - категорія, аудиторія, покриття, якість
 *  - пов'язані документи (не дублі, а суміжні)
 *  - рекомендації: що додати / покращити / прогалини в базі
 *  - наступні дії
 */

import { NextRequest, NextResponse } from "next/server";
import { llmGenerate } from "@/lib/llm";
import { loadSkill } from "@/lib/skill";
import { outlineSearch, buildPublicUrl } from "@/lib/outline";
import { gdriveSearch, isGDriveAvailable } from "@/lib/gdrive";

export const runtime = "nodejs";
export const maxDuration = 60;

const ANALYZE_PROMPT = `Ти — досвідчений аналітик бази знань компанії Selfy. Перед тобою НОВА стаття, яку готують до публікації в Outline. Твоя задача — дати корисний, конкретний аналіз та рекомендації.

КОНТЕКСТ SELFY: B2B оптовий продаж дитячих великогабаритних товарів. Клієнти = магазини/інтернет-магазини/дроп-шипери (НЕ роздріб). Бренди: Velano (власна ТМ), FreeON (ексклюзив), Waldi (стратегічний), American Club, Tega Baby, Demar тощо.

НОВИЙ ДОКУМЕНТ:
{{markdown}}

ВЖЕ ЗНАЙДЕНІ ПОТЕНЦІЙНО СХОЖІ В БАЗІ:
{{duplicates}}

ДОДАТКОВИЙ КОНТЕКСТ З БАЗИ ЗНАНЬ SELFY (релевантні фрагменти):
{{ragContext}}

ЗАВДАННЯ — поверни ТІЛЬКИ валідний JSON цього формату (без markdown-обгорток ${"\`"}${"\`"}${"\`"}):

{
  "overview": {
    "type": "коротко український тип (Регламент / Скрипт / FAQ / Онбординг / Політика / Опис продукту)",
    "audience": "конкретно хто читач (наприклад: 'Менеджери продажу, новачки')",
    "coverage": 3,
    "qualityScore": 75,
    "summary": "одне речення суті документа"
  },
  "relatedDocs": [
    {
      "title": "Назва дотичного документа з бази (НЕ той самий що дубль)",
      "relationship": "як вона перетинається з новою (наприклад: 'дотично згадує цей процес')",
      "recommendation": "що зробити (наприклад: 'додати backlink [[Назва]]')"
    }
  ],
  "recommendations": {
    "toAdd": [
      "Конкретні факти / розділи яких бракує (наприклад: 'Сума компенсації ремонту')"
    ],
    "toImprove": [
      "Що покращити в структурі (наприклад: 'розділ X довгий, розбити на 2')"
    ],
    "gaps": [
      "Прогалини в базі знань Selfy які виявив у процесі (наприклад: 'нема документа про повернення з пошкодженою коробкою')"
    ]
  },
  "nextActions": [
    {
      "label": "Створити чек-лист для бухгалтерії",
      "type": "create_doc",
      "rationale": "у документі описано як менеджер передає в бухгалтерію, але самої інструкції для бухгалтерії нема"
    }
  ]
}

ПРАВИЛА:
1. coverage: 1-5 (5 = повне покриття теми, 1 = поверхневе).
2. qualityScore: 0-100 (% якості структури).
3. summary: одне речення, до 120 символів.
4. relatedDocs: МАКС 3 елементи, ТІЛЬКИ якщо реально є дотичні документи (з ВЖЕ ЗНАЙДЕНИХ або RAG).
5. toAdd, toImprove, gaps: 2-4 елементи кожний, КОНКРЕТНІ (не загальні слова), українською.
6. nextActions: 2-4 пункти. type: "create_doc" / "update_doc" / "review" / "comment". rationale — пояснення чому.
7. Виключай: загальні поради ("документ повинен бути чітким"), очевидності, повтор контенту документа.
8. Усе українською. Без води.

Поверни ТІЛЬКИ JSON. Без преамбули.`;

function extractTitle(md: string): string {
  const m = md.match(/^#\s+(.+?)$/m);
  return m ? m[1].trim() : "Без назви";
}

function safeJson(text: string): any {
  // Витягуємо JSON-блок навіть якщо LLM додала ```json або преамбулу
  const cleaned = String(text)
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  const slice = cleaned.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch (err) {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { markdown, duplicates = [], type } = await req.json();
    if (!markdown || typeof markdown !== "string" || markdown.length < 50) {
      return NextResponse.json({ error: "markdown занадто короткий" }, { status: 400 });
    }

    const title = extractTitle(markdown);

    // Шукаємо ще RAG-контекст для аналізу (без перетину з відомими дублями)
    const knownIds = new Set(duplicates.map((d: any) => d.id));
    let ragSnippets: string[] = [];
    try {
      const [outlineCands, gdriveCands] = await Promise.all([
        outlineSearch(title, 4).catch(() => []),
        isGDriveAvailable() ? gdriveSearch(title, 3).catch(() => []) : Promise.resolve([]),
      ]);
      for (const c of outlineCands) {
        const id = c?.document?.id;
        if (!id || knownIds.has(id)) continue;
        ragSnippets.push(
          `• [Outline] "${c.document.title}" — ${(c.context || "").slice(0, 200)}`,
        );
      }
      for (const f of gdriveCands) {
        if (knownIds.has(f.id)) continue;
        ragSnippets.push(`• [GDrive] "${f.title}" (${f.owner || ""})`);
      }
    } catch {
      /* ignore */
    }

    const dupesText = duplicates.length
      ? duplicates
          .map((d: any) => `- [${d.source || "?"}] "${d.title}" (${Math.round((d.matchScore || 0) * 100)}% збіг)`)
          .join("\n")
      : "(не знайдено)";

    const ragText = ragSnippets.slice(0, 6).join("\n") || "(нічого додаткового)";

    const prompt = ANALYZE_PROMPT.replace("{{markdown}}", markdown.slice(0, 8000))
      .replace("{{duplicates}}", dupesText)
      .replace("{{ragContext}}", ragText);

    const { text } = await llmGenerate({
      system: "Ти — структурний аналітик. Завжди повертай чистий валідний JSON без преамбули.",
      user: prompt,
      maxTokens: 2500,
    });

    const analysis = safeJson(text);
    if (!analysis) {
      return NextResponse.json(
        { error: "LLM не повернула валідний JSON" },
        { status: 500 },
      );
    }

    return NextResponse.json({ analysis });
  } catch (err: any) {
    console.error("[analyze] error:", err);
    return NextResponse.json({ error: err.message || "Невідома помилка" }, { status: 500 });
  }
}
