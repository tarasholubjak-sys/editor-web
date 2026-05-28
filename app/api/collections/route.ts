/**
 * GET /api/collections
 * Повертає список колекцій з Outline (id + name).
 */

import { NextResponse } from "next/server";
import { outlineListCollections } from "@/lib/outline";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function GET() {
  try {
    const all = await outlineListCollections();
    const collections = all.map((c: any) => ({
      id: c.id,
      name: c.name,
    }));
    return NextResponse.json({ collections });
  } catch (err: any) {
    console.error("[collections] error:", err);
    return NextResponse.json({ collections: [], error: err.message }, { status: 200 });
  }
}
