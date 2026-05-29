import { NextResponse } from "next/server";
import { outlineListCollections } from "@/lib/outline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const collections = await outlineListCollections();
    if (!collections || collections.length === 0) {
      return NextResponse.json(
        { error: "В Outline немає колекцій або API ключ невалідний", collections: [] },
        { status: 500 },
      );
    }
    return NextResponse.json({ collections });
  } catch (err: any) {
    console.error("[collections] error:", err.message);
    return NextResponse.json(
      { error: err.message || "Не вдалось отримати колекції", collections: [] },
      { status: 500 },
    );
  }
}
