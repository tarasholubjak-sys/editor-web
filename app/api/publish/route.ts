/**
 * POST /api/publish
 *
 * Тіло: { markdown: string, type: string, collectionId?: string }
 * Відповідь: { url: string } або { duplicate: true, url, title, message }
 *
 * Створює чернетку в Outline (publish: false), яку потім керівник публікує руками.
 * Перевіряє exact-title duplicate ПЕРЕД створенням — щоб не плодити дублі.
 */

import { NextRequest, NextResponse } from "next/server";
import { outlineCreateDraft, outlineListCollections, outlineSearch, buildPublicUrl } from "@/lib/outline";
import { checkRate, rateKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

// Маппінг типу документа → дефолтна колекція (за назвою)
const TYPE_TO_COLLECTION: Record<string, string[]> = {
  sop: ["Інструкції", "Регламенти"],
  script: ["Скрипти", "Скріпти", "Відділ продажу"],
  faq: ["Інструкції", "Навчання"],
  onboarding: ["Навчання", "Про компанію"],
  policy: ["Про компанію", "Інструкції"],
  product: ["Про компанію"],
};

function extractTitle(md: string): string {
  const m = md.match(/^#\s+(.+?)$/m);
  return m ? m[1].trim() : "Без назви";
}

async function pickCollection(type: string, override?: string): Promise<string> {
  const collections = await outlineListCollections();
  if (collections.length === 0) throw new Error("В Outline немає колекцій");

  // Якщо явно вказано — повертаємо
  if (override) {
    const found = collections.find((c: any) => c.id === override || c.name === override);
    if (found) return found.id;
  }

  // По типу — шукаємо першу яка співпадає з преферованими
  const candidates = TYPE_TO_COLLECTION[type] || [];
  for (const wanted of candidates) {
    const found = collections.find((c: any) => c.name?.toLowerCase().includes(wanted.toLowerCase()));
    if (found) return found.id;
  }

  // Fallback — перша колекція
  return collections[0].id;
}

export async function POST(req: NextRequest) {
  const key = rateKey(req);
  if (!checkRate(key, 10, 60_000)) {
    return NextResponse.json({ error: "Забагато запитів. Спробуй через хвилину." }, { status: 429 });
  }

  try {
    const { markdown, type, collectionId } = await req.json();
    if (!markdown || typeof markdown !== "string" || markdown.length < 50) {
      return NextResponse.json({ error: "Markdown занадто короткий" }, { status: 400 });
    }

    const title = extractTitle(markdown);

    // Dedup-перевірка ДО створення: якщо exact title match — повертаємо існуючу
    const existing = await outlineSearch(title, 3).catch(() => []);
    const exactMatch = existing.find(
      (c: any) => c?.document?.title?.toLowerCase().trim() === title.toLowerCase().trim(),
    );
    if (exactMatch?.document?.id) {
      return NextResponse.json({
        duplicate: true,
        url: buildPublicUrl(exactMatch.document.url),
        title: exactMatch.document.title,
        message: "Документ з такою назвою вже існує. Створення скасовано — оновіть існуючий замість дубля.",
      });
    }

    const collId = await pickCollection(type || "sop", collectionId);

    // Прибираємо H1 з тіла (Outline сам показує title)
    const body = markdown.replace(/^#\s+.+?\n+/, "").trim();

    const { url } = await outlineCreateDraft({
      title,
      text: body,
      collectionId: collId,
    });

    return NextResponse.json({ url, title });
  } catch (err: any) {
    console.error("[publish] error:", err);
    return NextResponse.json({ error: err.message || "Помилка публікації" }, { status: 500 });
  }
}
