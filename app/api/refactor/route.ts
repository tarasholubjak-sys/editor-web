/**
 * POST /api/refactor
 *
 * Тіло: { rawText: string }
 * Відповідь: { markdown, type, duplicates?, recommendation? }
 *
 * Перевірка дублікатів: паралельно в Outline + Google Drive.
 */

import { NextRequest, NextResponse } from "next/server";
import { llmGenerate } from "@/lib/llm";
import { loadSkill, loadTemplate } from "@/lib/skill";
import { outlineSearch, outlineListCollections, buildPublicUrl } from "@/lib/outline";
import { gdriveSearch, isGDriveAvailable } from "@/lib/gdrive";

export const runtime = "nodejs";
export const maxDuration = 90;

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

Поверни ТІЛЬКИ одне слово (sop/script/faq/onboarding/policy/product). Без пояснень.`;

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

function extractTitle(md: string): string {
  const m = md.match(/^#\s+(.+?)$/m);
  return m ? m[1].trim() : "Без назви";
}

// Витягуємо ключові слова з тексту (для дублікат-search) — без stopwords
function extractKeywords(text: string, max = 8): string[] {
  const stop = new Set([
    "як", "що", "де", "коли", "чи", "якщо", "тоді", "буде", "було",
    "тільки", "лише", "теж", "можна", "треба", "потрібно", "над", "під",
    "мене", "тебе", "нього", "наш", "ваш", "цей", "ця", "ці",
  ]);
  return Array.from(
    new Set(
      String(text || "")
        .toLowerCase()
        .split(/[\s,.;:!?()"'«»\-–—/\\]+/u)
        .filter((w) => w.length >= 4 && !stop.has(w)),
    ),
  ).slice(0, max);
}

function fmtDate(iso?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("uk-UA", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function normScore(raw: number | undefined): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0.3;
  if (raw > 1) return Math.min(raw / 10, 1);
  return Math.max(0, Math.min(raw, 1));
}

// Простий контентний score за збіг ключових слів у заголовку
function titleScore(title: string, keywords: string[]): number {
  if (!title || keywords.length === 0) return 0;
  const t = title.toLowerCase();
  const hits = keywords.filter((k) => t.includes(k)).length;
  return Math.min(hits / Math.max(keywords.length, 3), 1);
}

export async function POST(req: NextRequest) {
  try {
    const { rawText } = await req.json();
    if (!rawText || typeof rawText !== "string" || rawText.trim().length < 20) {
      return NextResponse.json({ error: "Текст занадто короткий (мінімум 20 символів)" }, { status: 400 });
    }

    const safeText = rawText.slice(0, 30000);

    // 1. Класифікувати тип
    const type = await classify(safeText);

    // 2. Завантажити skill + template
    const { systemPrompt } = loadSkill();
    const template = loadTemplate(type);

    // 3. LLM refactor
    const userMessage = `СИРИЙ ТЕКСТ ДОКУМЕНТА (тип: ${type}):
${safeText}

ШАБЛОН ДЛЯ ЦЬОГО ТИПУ:
${template}

ЗАВДАННЯ:
1. Витягни суть зі сирого тексту.
2. Прибери шум.
3. Застосуй шаблон.
4. Заповни шапку (поточна дата ${new Date().toISOString().slice(0, 10)}).
5. Доповни цінним: чек-листи, типові помилки.
6. Дірки позначай '⚠️ Потрібно уточнити' — НЕ вигадуй фактів.
7. Використовуй Notice блоки (:::info, :::warning, :::tip, :::success), Mermaid для алгоритмів, таблиці.
8. НЕ роби блок "Зміст" — Outline сам генерує.

Поверни ТІЛЬКИ готовий markdown починаючи з H1. Без преамбули.`;

    const { text: markdown, provider } = await llmGenerate({
      system: systemPrompt,
      user: userMessage,
      maxTokens: 8000,
    });

    // 4. Перевірка дублікатів — паралельно Outline + GDrive
    let duplicates: any[] = [];
    let recommendation = "";
    try {
      const title = extractTitle(markdown);
      const keywords = extractKeywords(safeText.slice(0, 2000), 6);
      const titleQuery = title;

      const [outlineCandidates, allCollections, gdriveCandidates] = await Promise.all([
        outlineSearch(titleQuery, 5).catch(() => []),
        outlineListCollections().catch(() => []),
        isGDriveAvailable() ? gdriveSearch(titleQuery, 5).catch(() => []) : Promise.resolve([]),
      ]);

      const collById = new Map(allCollections.map((c: any) => [c.id, c.name]));

      // Outline → нормалізовані duplicates
      const outlineDupes = outlineCandidates
        .filter((c: any) => c?.document?.id)
        .map((c: any) => {
          const score = Math.max(
            normScore(c.ranking),
            titleScore(c.document.title || "", [...keywords, title.toLowerCase()]),
          );
          return {
            source: "outline" as const,
            id: c.document.id,
            title: c.document.title,
            collection: collById.get(c.document.collectionId) || "",
            updated: fmtDate(c.document.updatedAt),
            url: buildPublicUrl(c.document.url),
            matchScore: score,
          };
        });

      // GDrive → з більш проматичною оцінкою (тільки за title match)
      const gdriveDupes = gdriveCandidates.map((f) => ({
        source: "gdrive" as const,
        id: f.id,
        title: f.title,
        collection: f.owner || "Google Drive",
        updated: fmtDate(f.modifiedTime),
        url: f.url,
        matchScore: titleScore(f.title, [...keywords, title.toLowerCase()]),
      }));

      duplicates = [...outlineDupes, ...gdriveDupes]
        .filter((d) => d.matchScore > 0.1)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 6);

      if (duplicates.length > 0 && duplicates[0].matchScore >= 0.6) {
        const top = duplicates[0];
        if (top.source === "outline") {
          recommendation = `Висока ймовірність дубліката з "${top.title}" в Outline — рекомендую оновити існуючу статтю замість створення нової.`;
        } else {
          recommendation = `Схожий документ є в Google Drive ("${top.title}") — поки що не в офіційній базі. Варто перенести і об'єднати.`;
        }
      } else if (duplicates.length > 0) {
        recommendation = "Знайдено тематично схожі матеріали — перегляньте перед публікацією.";
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
