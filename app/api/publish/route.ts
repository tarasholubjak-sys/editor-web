/**
 * POST /api/publish
 *
 * Тіло: { markdown: string, type: string, collectionId?: string, documentId?: string }
 * Відповідь: { url } | { duplicate, url, title, message } | { url, updated: true }
 *
 * Без documentId → створює НОВУ чернетку (publish:false) + exact-title dedup-перевірка.
 * З documentId → ОНОВЛЮЄ існуючий документ (анти-дубль merge-флоу), dedup не робиться.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  outlineCreateDraft,
  outlineUpdateDocument,
  outlineListCollections,
  outlineSearch,
  buildPublicUrl,
} from "@/lib/outline";
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

  if (override) {
    const found = collections.find((c: any) => c.id === override || c.name === override);
    if (found) return found.id;
  }

  const candidates = TYPE_TO_COLLECTION[type] || [];
  for (const wanted of candidates) {
    const found = collections.find((c: any) => c.name?.toLowerCase().includes(wanted.toLowerCase()));
    if (found) return found.id;
  }

  return collections[0].id;
}

export async function POST(req: NextRequest) {
  const key = rateKey(req);
  if (!checkRate(key, 10, 60_000)) {
    return NextResponse.json({ error: "Забагато запитів. Спробуй через хвилину." }, { status: 429 });
  }

  try {
    const { markdown, type, collectionId, documentId } = await req.json();
    if (!markdown || typeof markdown !== "string" || markdown.length < 50) {
      return NextResponse.json({ error: "Markdown занадто короткий" }, { status: 400 });
    }

    const title = extractTitle(markdown);
    // Прибираємо H1 з тіла (Outline сам показує title)
    const body = markdown.replace(/^#\s+.+?\n+/, "").trim();

    // === Режим ОНОВЛЕННЯ існуючого документа (merge-флоу) ===
    if (documentId && typeof documentId === "string") {
      const { url } = await outlineUpdateDocument({ id: documentId, title, text: body });
      return NextResponse.json({ url, title, updated: true });
    }

    // === Режим СТВОРЕННЯ нової чернетки + dedup-перевірка ===
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
