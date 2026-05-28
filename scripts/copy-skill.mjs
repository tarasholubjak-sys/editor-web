/**
 * Перед білдом копіюємо ../skills/selfy-knowledge-editor → ./skill-data
 * щоб Vercel мав ці файли в build context.
 * Локально теж можна запустити.
 */

import { cpSync, existsSync, mkdirSync, copyFileSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SKILL_SRC = join(ROOT, "..", "skills", "selfy-knowledge-editor");
const SKILL_DEST = join(ROOT, "skill-data");
const CONTEXT_SRC = join(ROOT, "..", "wiki-selfy-bot", "src", "selfy-context.js");
const CONTEXT_DEST = join(SKILL_DEST, "selfy-context.js");

if (!existsSync(SKILL_SRC)) {
  console.error(`[copy-skill] не знайдено: ${SKILL_SRC}`);
  process.exit(0); // не падаємо щоб локально працювало без копіювання
}

if (existsSync(SKILL_DEST)) rmSync(SKILL_DEST, { recursive: true, force: true });
mkdirSync(SKILL_DEST, { recursive: true });

cpSync(SKILL_SRC, SKILL_DEST, { recursive: true });
console.log(`[copy-skill] OK: ${SKILL_SRC} → ${SKILL_DEST}`);

if (existsSync(CONTEXT_SRC)) {
  copyFileSync(CONTEXT_SRC, CONTEXT_DEST);
  console.log(`[copy-skill] OK: selfy-context.js → ${CONTEXT_DEST}`);
} else {
  console.warn(`[copy-skill] selfy-context.js не знайдено: ${CONTEXT_SRC}`);
}
