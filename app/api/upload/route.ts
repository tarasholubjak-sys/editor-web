/**
 * POST /api/upload
 *
 * Form-data: file=<File>
 * Відповідь: { text: string }
 *
 * Підтримка: .txt, .md, .docx, .pdf (поки тільки .docx через mammoth; .pdf — заглушка)
 */

import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Файл не передано" }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Файл занадто великий (макс 10 МБ)" }, { status: 400 });
    }

    const name = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());

    if (name.endsWith(".txt") || name.endsWith(".md")) {
      return NextResponse.json({ text: buffer.toString("utf8") });
    }

    if (name.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer });
      return NextResponse.json({ text: result.value });
    }

    if (name.endsWith(".pdf")) {
      return NextResponse.json(
        {
          error: "Поки PDF не підтримується. Скопіюй текст і вставте у поле, або експортуй у .docx.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Непідтримуваний формат. Завантаж .txt / .md / .docx" },
      { status: 400 },
    );
  } catch (err: any) {
    console.error("[upload] error:", err);
    return NextResponse.json({ error: err.message || "Помилка читання файлу" }, { status: 500 });
  }
}
