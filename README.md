# Selfy Knowledge Editor — Веб-редактор

AI-редактор для бази знань Selfy. Перетворює сирі документи (текст, .docx) у структуровані статті готові до публікації в Outline.

## Як виглядає

```
┌───────────────────────────────────────────────┐
│  S  Selfy Knowledge Editor      ↗ Outline     │
├───────────────────────────────────────────────┤
│  [📎 Файл] [Приклад]              [✨ Переписати]│
├──────────────────────┬────────────────────────┤
│  📥 Сирий текст       │  📄 Результат          │
│                      │                        │
│  [textarea]          │  Markdown / Preview    │
│                      │                        │
├──────────────────────┴────────────────────────┤
│  🔍 Знайдено схожі статті в Outline:           │
│  • [Стаття X] — 67% збіг                       │
│                                               │
│      [✕ Очистити]  [📤 Опублікувати в Outline] │
└───────────────────────────────────────────────┘
```

## Швидкий старт (локально)

```bash
cd C:\selfy-outline-mcp\editor-web
npm install
cp .env.example .env.local
# Заповни ключі в .env.local
npm run dev
```

Відкрий http://localhost:3000

## Деплой на Vercel (швидко, безкоштовно)

### Крок 1. Створи аккаунт Vercel

1. https://vercel.com/signup → Sign up with GitHub (рекомендую — простіше)
2. Підтверди email

### Крок 2. Запушити код у GitHub

```powershell
# Windows PowerShell
cd C:\selfy-outline-mcp\editor-web
git init
git add .
git commit -m "feat: initial editor-web MVP"

# Створи новий приватний репо на GitHub: https://github.com/new
# Назва: editor-web (або як зручно)

git remote add origin git@github.com:tarasholubjak-sys/editor-web.git
git branch -M main
git push -u origin main
```

### Крок 3. Підключи репо до Vercel

1. https://vercel.com/new
2. Import Git Repository → обери `editor-web`
3. **Root Directory:** `./` (за замовчуванням)
4. **Framework Preset:** Next.js (автодетект)
5. **Build Command:** залиш як є (`npm run build`)
6. **Output Directory:** залиш як є

### Крок 4. Додай Environment Variables в Vercel

Project Settings → Environment Variables → Add:

```
GEMINI_API_KEY = <твій ключ>
ANTHROPIC_API_KEY = <твій ключ>
OPENAI_API_KEY = <твій ключ>
LLM_CHAIN = gemini,anthropic,openai
OUTLINE_BASE_URL = https://wiki.selfy.com.ua/api
OUTLINE_PUBLIC_URL = https://wiki.selfy.com.ua
OUTLINE_API_KEY = <твій Outline ключ>
```

⚠️ **ВАЖЛИВО:** Outline має бути доступний по HTTPS публічно. Якщо зараз `wiki.selfy.com.ua` доступний тільки через VPN — Vercel не зможе достукатись. Треба або:
- Опублікувати Outline на public HTTPS endpoint
- Або потримати редактор на власному сервері (а не Vercel)

### Крок 5. Redeploy

Після додавання env — Project → Deployments → останній deploy → ⋯ → Redeploy.

### Крок 6. Готово

URL буде типу `https://editor-web-{hash}.vercel.app` — це і є твій сайт.

Можна додати custom домен: Project Settings → Domains → Add → `editor.selfy.com.ua` (треба DNS-запис в кабінеті домену).

## Структура

```
editor-web/
├── app/
│   ├── page.tsx              ← головна сторінка (UI)
│   ├── layout.tsx
│   ├── globals.css
│   └── api/
│       ├── refactor/         ← POST /api/refactor (LLM обробка)
│       ├── upload/           ← POST /api/upload (читання .docx)
│       └── publish/          ← POST /api/publish (створення чернетки в Outline)
├── components/               ← (поки порожньо, UI весь у page.tsx)
├── lib/
│   ├── llm.ts                ← chain Gemini → Anthropic → OpenAI
│   ├── skill.ts              ← завантажує ../skills/selfy-knowledge-editor/
│   └── outline.ts            ← Outline API клієнт
├── scripts/
│   └── copy-skill.mjs        ← prebuild: копіює ../skills/ → ./skill-data/
├── public/
├── skill-data/               ← (генерується при `npm run dev` чи `build`)
├── .env.example
├── package.json
├── next.config.js
├── tailwind.config.ts
└── tsconfig.json
```

## Що працює (MVP)

- ✅ Двоколоночний редактор (textarea + markdown preview)
- ✅ Завантаження .docx через mammoth
- ✅ /api/refactor — обробляє через LLM з повним скілом Selfy
- ✅ Класифікація типу документа (SOP/Script/FAQ/Onboarding/Policy/Product)
- ✅ Перевірка дублів через Outline search
- ✅ /api/publish — створення чернетки в Outline
- ✅ Копіювання markdown в буфер
- ✅ Toggle Preview / Raw markdown
- ✅ Адаптивно під робочий комп'ютер

## Що НЕ зроблено (поки що)

- ❌ Auth (зараз доступ для всіх хто знає URL)
- ❌ PDF parsing (через pdf-parse — додамо)
- ❌ Імпорт з Google Doc URL
- ❌ Mobile responsive (зараз тільки desktop)
- ❌ Збереження історії переписаних документів
- ❌ Вибір колекції в Outline вручну з UI (зараз авто по типу)

## Кольори Selfy

Палітра в `tailwind.config.ts`:
- **primary** (синій) — основний бренд
- **accent** (помаранчевий) — акценти, кнопка публікації

Якщо точні HEX-коди не такі — заміни в `tailwind.config.ts → theme.extend.colors`.

## Troubleshooting

**"Не знайдено файли скіла"** → запусти `npm run prebuild` (копіює `../skills/selfy-knowledge-editor/` → `./skill-data/`).

**"OUTLINE_BASE_URL не задано"** → перевір `.env.local` (локально) або Vercel Env Vars.

**"Усі LLM провайдери не справились"** → перевір що принаймні один ключ заповнений і працює.

**Гальмує на refactor** → Gemini в free tier може 429-итись. Або оплати $10 кредит, або переключи `LLM_CHAIN=anthropic,gemini,openai`.

## Ліцензія

UNLICENSED — внутрішнє використання Selfy.
