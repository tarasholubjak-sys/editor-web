/**
 * POST /api/upload
 *
 * Form-data: file=<File>
 * Відповідь: { text: string }
 *
 * Підтримка: .txt, .md, .docx, .pdf
 */

import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import { checkRate, rateKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_SIZE = 5 * 1024 * 1024;
const PARSE_TIMEOUT_MS = 30000;

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  const t = new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label}: timeout ${ms}ms`)), ms));
  return Promise.race([p, t]);
}

export async function POST(req: NextRequest) {
  const key = rateKey(req);
  if (!checkRate(key, 10, 60000)) {
    return NextResponse.json({ error: "Забагато запитів. Спробуй через хвилину." }, { status: 429 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Файл не передано" }, { status: 400 });
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Файл занадто великий (макс 5 МБ)" }, { status: 400 });
    }

    const name = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());

    if (name.endsWith(".txt") || name.endsWith(".md")) {
      return NextResponse.json({ text: buffer.toString("utf8") });
    }

    if (name.endsWith(".docx")) {
      const result = await withTimeout(
        mammoth.extractRawText({ buffer }),
        PARSE_TIMEOUT_MS,
        "DOCX parse",
      );
      return NextResponse.json({ text: result.value });
    }

    if (name.endsWith(".pdf")) {
      try {
        // pdf-parse динамічно — щоб уникнути проблем з ESM/CJS
        const pdfMod: any = await import("pdf-parse");
        const pdfParse = pdfMod.default || pdfMod;
        const data: any = await withTimeout(pdfParse(buffer), PARSE_TIMEOUT_MS, "PDF parse");
        const text = String(data.text || "").trim();
        if (!text) {
          return NextResponse.json(
            { error: "PDF не містить текстового шару (можливо це скан). Скопіюй текст вручну або експортуй у .docx." },
            { status: 400 },
          );
        }
        return NextResponse.json({ text });
      } catch (err: any) {
        console.error("[upload] pdf-parse error:", err);
        return NextResponse.json(
          { error: `Не вдалось прочитати PDF: ${err.message?.slice(0, 100) || "невідома помилка"}` },
          { status: 400 },
        );
      }
    }

    return NextResponse.json(
      { error: "Непідтримуваний формат. Завантаж .txt / .md / .docx / .pdf" },
      { status: 400 },
    );
  } catch (err: any) {
    console.error("[upload] error:", err);
    return NextResponse.json({ error: err.message || "Помилка читання файлу" }, { status: 500 });
  }
}
