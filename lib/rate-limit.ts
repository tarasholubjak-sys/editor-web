/**
 * Простий in-memory rate-limiter для захисту від cost-exhaustion атак.
 * Лімітує запити per email або per IP.
 */

const buckets = new Map<string, number[]>();
const CLEANUP_INTERVAL_MS = 60_000;
const KEEP_WINDOW_MS = 3_600_000;
let cleanupTimer: NodeJS.Timeout | null = null;

function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [k, arr] of buckets.entries()) {
      const fresh = arr.filter((t) => now - t < KEEP_WINDOW_MS);
      if (fresh.length === 0) buckets.delete(k);
      else buckets.set(k, fresh);
    }
  }, CLEANUP_INTERVAL_MS);
  if (typeof cleanupTimer.unref === "function") cleanupTimer.unref();
}

/**
 * Перевіряє чи запит у межах ліміту. Записує timestamp якщо дозволено.
 * @returns true якщо дозволено, false якщо перевищений ліміт
 */
export function checkRate(key: string, max: number, windowMs: number): boolean {
  startCleanup();
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) return false;
  arr.push(now);
  buckets.set(key, arr);
  return true;
}

// Глобальний ліміт per-endpoint (backstop проти X-Forwarded-For спуфінгу:
// навіть з підробленим IP сумарний обсяг дорогих LLM-викликів обмежений).
const globalBuckets = new Map<string, number[]>();
export function checkGlobalRate(name: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (globalBuckets.get(name) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) return false;
  arr.push(now);
  globalBuckets.set(name, arr);
  return true;
}

/** Формує ключ для rate-limit (email або IP). */
export function rateKey(req: Request, email?: string | null): string {
  if (email) return `e:${email.toLowerCase()}`;
  const fwd = req.headers.get("x-forwarded-for") || "";
  const ip = fwd.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  return `ip:${ip}`;
}
