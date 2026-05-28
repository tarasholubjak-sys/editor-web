/**
 * Завантажує файли скіла selfy-knowledge-editor для збірки повного промпту.
 *
 * Скіл лежить у `../skills/selfy-knowledge-editor/`.
 * Для Vercel — файли копіюються в `editor-web/skill-data/` під час білду
 * (див. README про prebuild step).
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

const SKILL_PATHS = [
  // Локальна розробка — поряд з editor-web
  join(process.cwd(), "..", "skills", "selfy-knowledge-editor"),
  // Vercel/prod — копія в editor-web
  join(process.cwd(), "skill-data"),
];

function findSkillRoot(): string {
  for (const p of SKILL_PATHS) {
    if (existsSync(join(p, "prompt.md"))) return p;
  }
  throw new Error(
    `Не знайдено файли скіла. Шукав у: ${SKILL_PATHS.join(", ")}. Запусти 'npm run prebuild' або скопіюй ../skills/selfy-knowledge-editor → ./skill-data`,
  );
}

let cached: { systemPrompt: string; selfyContext: string } | null = null;

export function loadSkill(): { systemPrompt: string; selfyContext: string } {
  if (cached) return cached;

  const root = findSkillRoot();
  const prompt = readFileSync(join(root, "prompt.md"), "utf8");
  const formatting = readFileSync(join(root, "rules", "formatting-style.md"), "utf8");
  const outline = readFileSync(join(root, "rules", "outline-capabilities.md"), "utf8");

  // Selfy context — читаємо з src/selfy-context.js бота
  const contextPaths = [
    join(process.cwd(), "..", "wiki-selfy-bot", "src", "selfy-context.js"),
    join(process.cwd(), "skill-data", "selfy-context.js"),
  ];
  let selfyContext = "";
  for (const cp of contextPaths) {
    if (existsSync(cp)) {
      const raw = readFileSync(cp, "utf8");
      const m = raw.match(/export const SELFY_CONTEXT = `([\s\S]*?)`;/);
      if (m) selfyContext = m[1];
      break;
    }
  }

  const systemPrompt = [
    prompt,
    "═══════════════════════════════════════════════",
    "## ДОДАТОК A: СТАНДАРТ ФОРМАТУВАННЯ SELFY",
    formatting,
    "═══════════════════════════════════════════════",
    "## ДОДАТОК B: МОЖЛИВОСТІ OUTLINE 1.7+",
    outline,
    "═══════════════════════════════════════════════",
    "## ДОДАТОК C: КОНТЕКСТ КОМПАНІЇ SELFY",
    selfyContext || "(контекст недоступний — НЕ вигадуй фактів про компанію)",
  ].join("\n\n");

  cached = { systemPrompt, selfyContext };
  return cached;
}

export function loadTemplate(type: string): string {
  const root = findSkillRoot();
  const allowed = ["sop", "script", "faq", "onboarding", "policy", "product"];
  const safe = allowed.includes(type) ? type : "sop";
  return readFileSync(join(root, "templates", `${safe}.md`), "utf8");
}
