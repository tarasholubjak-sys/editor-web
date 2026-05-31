import { NextRequest, NextResponse } from "next/server";
import { outlineListCollections } from "@/lib/outline";
import { checkRate, rateKey, checkGlobalRate } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!checkRate(rateKey(req), 30, 60_000) || !checkGlobalRate("collections", 60, 60_000)) {
    return NextResponse.json({ error: "Забагато запитів", collections: [] }, { status: 429 });
  }
  try {
    const raw = await outlineListCollections();
    if (!raw || raw.length === 0) {
      return NextResponse.json(
        { error: "В Outline немає колекцій або API ключ невалідний", collections: [] },
        { status: 500 },
      );
    }
    // Трим: віддаємо лише те, що треба UI (без внутрішніх sharing/permission метаданих)
    const collections = raw.map((c: any) => ({ id: c.id, name: c.name }));
    return NextResponse.json({ collections });
  } catch (err: any) {
    console.error("[collections] error:", err.message);
    return NextResponse.json(
      { error: "Не вдалось отримати колекції", collections: [] },
      { status: 500 },
    );
  }
}
