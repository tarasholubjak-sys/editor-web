// API limits (синхронізовано з server-side)
export const MIN_INPUT_CHARS = 20;
export const MIN_ANALYZE_CHARS = 50;

// UI
export const TOAST_DURATION_MS = 2500;
export const AI_STEP_DURATION_MS = 1800;

export const TEMPLATES = [
  { id: "sop", name: "SOP / Регламент" },
  { id: "script", name: "Скрипт продажу" },
  { id: "faq", name: "FAQ" },
  { id: "onboarding", name: "Онбординг" },
  { id: "policy", name: "Політика" },
  { id: "product", name: "Опис бренду" },
] as const;

export const AI_STEPS = [
  "Аналізую структуру тексту…",
  "Виділяю заголовки та кроки…",
  "Форматую списки й виноски…",
  "Перевіряю дублікати в Outline та Google Drive…",
];
