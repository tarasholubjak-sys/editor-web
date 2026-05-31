/**
 * Підписаний токен оновлення (HMAC) для merge-флоу.
 *
 * Проблема: /api/publish з documentId може оновити будь-який Outline-доку.
 * Захист: оновлення дозволяється лише з токеном, який сервер видав у /api/merge
 * для КОНКРЕТНОГО docId і на обмежений час. Підробити без секрету не можна.
 * (Повне закриття — auth+TLS; це піднімає планку + робить зловживання простежуваним.)
 */

import { createHmac } from "crypto";

const SECRET =
  process.env.AUTH_SECRET || process.env.OUTLINE_API_KEY || "selfy-fallback-secret";
const TTL_MS = 30 * 60 * 1000; // 30 хв

export function signUpdateToken(docId: string): string {
  const exp = Date.now() + TTL_MS;
  const payload = `${docId}.${exp}`;
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex").slice(0, 32);
  return Buffer.from(`${payload}.${sig}`, "utf8").toString("base64url");
}

export function verifyUpdateToken(token: string, docId: string): boolean {
  if (!token || !docId) return false;
  try {
    const parts = Buffer.from(token, "base64url").toString("utf8").split(".");
    const [tid, expStr, sig] = parts;
    if (tid !== docId || !expStr || !sig) return false;
    if (Date.now() > Number(expStr)) return false;
    const expected = createHmac("sha256", SECRET)
      .update(`${tid}.${expStr}`)
      .digest("hex")
      .slice(0, 32);
    return sig.length === expected.length && sig === expected;
  } catch {
    return false;
  }
}
