# editor-web — інструкція для Claude

Цей файл читається при відкритті папки `editor-web/`. Дає швидкий контекст специфічно для цього компонента.

> Корневий контекст у `../CLAUDE.md`. Архітектура у `../ARCHITECTURE.md`.

## Швидко

- **Що:** Next.js 14 AI-редактор статей. Перетворює сирий текст / .docx → структуровану markdown-статтю → чернетку в Outline.
- **Версія:** 0.3.0 (Phase 1+2+3 stabilization done 2026-05-29)
- **Hosting:** Ubuntu 192.168.88.20, pm2, port 3001, папка `/opt/editor-web`
- **Доступ:** `http://192.168.88.20:3001` через VPN. Authentication ВИМКНЕНО (middleware → `.bak`) поки нема TLS.
- **Repo:** github.com/tarasholubjak-sys/editor-web (Public)

## Поточний стан

| Що | Стан |
|---|---|
| Tree-analyzer | ✅ працює (повний JSON з analysis 12 колекцій) |
| Refactor → Analyze → Publish | ✅ працює |
| Rate-limit | ✅ активно |
| Prompt injection guards | ✅ активно |
| Publish dedup-check | ✅ активно |
| Google OAuth | ⏸ вимкнено (чекає TLS) |
| editor.selfy.com.ua | ⏸ DNS у Ярослава, чекає налаштування на Hetzner |
| pm2 startup | ✅ налаштовано (переживе рестарт) |

## Структура

```
editor-web/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── collections/route.ts
│   │   ├── refactor/route.ts        ← raw text → markdown (30/хв)
│   │   ├── analyze/route.ts         ← AI аналіз готового md (30/хв)
│   │   ├── tree/route.ts            ← аналіз ВСІЄЇ бази (6/хв)
│   │   ├── publish/route.ts         ← створення чернетки (10/хв)
│   │   └── upload/route.ts          ← upload pdf/docx/txt (10/хв, 5MB)
│   ├── auth/signin/page.tsx
│   ├── tree/page.tsx
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                     ← головна (258 рядків orchestrator)
├── components/                      ← Topbar, SourcePane, PreviewPane,
│                                       DuplicatesPanel, AnalysisPanel, FooterBar, Toast
├── lib/
│   ├── llm.ts                       ← LLM chain + retry
│   ├── outline.ts                   ← Outline API helpers
│   ├── gdrive.ts                    ← Google Drive service account
│   ├── skill.ts                     ← завантажує prompt+template
│   ├── rate-limit.ts                ← in-memory limiter
│   ├── utils.ts                     ← extractTitle, safeCopy
│   ├── constants.ts                 ← magic numbers, TEMPLATES
│   └── types.ts                     ← shared TS interfaces
├── auth.ts                          ← NextAuth Google + allowlist
├── middleware.ts                    ← редірект на signin (на сервері .bak)
├── skill-data/                      ← копія skills/selfy-knowledge-editor/
└── scripts/copy-skill.mjs           ← prebuild script
```

## API endpoints

| Endpoint | Метод | Що робить | Rate limit |
|----------|-------|-----------|------------|
| `/api/collections` | GET | Список колекцій Outline | none |
| `/api/refactor` | POST | rawText → markdown + duplicates | 30/хв |
| `/api/analyze` | POST | markdown → AI analysis | 30/хв |
| `/api/tree` | GET | Повний AI-аналіз бази (5хв кеш, ?force=1) | 6/хв |
| `/api/publish` | POST | Створення чернетки в Outline (з dedup) | 10/хв |
| `/api/upload` | POST | multipart file (pdf/docx/txt, 5MB) | 10/хв |
| `/api/auth/[...nextauth]` | GET/POST | NextAuth handlers | — |

## ENV (`/opt/editor-web/.env`)

```bash
# LLM
GEMINI_API_KEY=          # вичерпано — пропускається
ANTHROPIC_API_KEY=       # основний
OPENAI_API_KEY=          # fallback
LLM_CHAIN=anthropic,openai,gemini
OPENAI_MODEL=gpt-4o-mini
ANTHROPIC_MODEL=claude-haiku-4-5

# Outline
OUTLINE_BASE_URL=https://wiki.selfy.com.ua/api
OUTLINE_PUBLIC_URL=https://wiki.selfy.com.ua
OUTLINE_API_KEY=

# Google Drive
GDRIVE_KEY_PATH=/opt/wiki-selfy-bot/secrets/gdrive-key.json

# Auth (поки не використовується, middleware off)
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
ALLOWED_EMAILS=tarasholubjak@gmail.com
AUTH_TRUST_HOST=true
AUTH_URL=https://editor.selfy.com.ua
```

## Локально (Windows)

```powershell
cd C:\selfy-outline-mcp\editor-web
npm install
# .env.local — скопіюй .env.example і заповни
npm run dev
```

## Деплой (стандартний цикл)

```powershell
# 1. PowerShell
cd C:\selfy-outline-mcp\editor-web
Remove-Item -Force -ErrorAction SilentlyContinue .git\index.lock
git add .
git commit -m "feat: ..."
git push
```

```bash
# 2. SSH Ubuntu
ssh su@192.168.88.20
cd /opt/editor-web && \
  git pull && \
  NODE_OPTIONS="--max-old-space-size=4096" npm run build && \
  pm2 restart editor-web --update-env && \
  sleep 3 && \
  pm2 logs editor-web --lines 10 --nostream
```

## Smoke tests (на сервері)

```bash
curl -s -o /dev/null -w "tree: HTTP %{http_code}\n" http://localhost:3001/api/tree
curl -s -o /dev/null -w "collections: HTTP %{http_code}\n" http://localhost:3001/api/collections
curl -s -o /dev/null -w "home: HTTP %{http_code}\n" http://localhost:3001/

# Повний пайплайн
curl -s -X POST http://localhost:3001/api/refactor \
  -H "content-type: application/json" \
  -d "{\"rawText\":\"Тестовий документ повернення товару клієнт магазин менеджер бухгалтерія.\"}" \
  | head -c 200
```

## Edit-tool bug

Edit ламає українські файли (NULL bytes, обрізання). Використовуй **Write з повним вмістом** + `tail -3` для перевірки. Якщо обрізало — дописуй через bash heredoc або Python.

## Як вмикнути OAuth (після Ярослава)

1. Дочекатись щоб Ярослав налаштував DNS+TLS на Hetzner для editor.selfy.com.ua
2. На сервері: `mv /opt/editor-web/middleware.ts.bak /opt/editor-web/middleware.ts`
3. `pm2 restart editor-web --update-env`
4. Перевір `https://editor.selfy.com.ua` має редіректити на /auth/signin
5. Тицянути "Увійти через Google" — вхід через tarasholubjak@gmail.com (allowlist)

## Як додати юзера в allowlist

Редагуй `ALLOWED_EMAILS` у `/opt/editor-web/.env` через кому:
```
ALLOWED_EMAILS=tarasholubjak@gmail.com,manager1@selfy.com.ua
```
Потім `pm2 restart editor-web --update-env`.

## Troubleshooting

| Симптом | Діагностика | Фікс |
|---------|------------|------|
| Tree повертає "LLM не повернула валідний JSON" | `pm2 logs editor-web --err` | Збільшити maxTokens, перевір LLM_CHAIN не Gemini-first |
| Build падає /api/tree timeout | static page generation | Перевір що є `export const dynamic = "force-dynamic"` |
| Build SIGTRAP (V8 краш) | Node 22+Next 14 баг | Запусти `npm run build` ще раз |
| Failed to compile JSX | Edit обрізав файл | Відновити з git + python clean NULL bytes |
| MissingCSRF після OAuth | Cookies/TLS mismatch | AUTH_URL=https://... + clear cookies |
| Gemini 429 | credits depleted | LLM_CHAIN=anthropic,openai,gemini |

## НЕ робити

- НЕ вмикати middleware без TLS (cookies під загрозою)
- НЕ міняти LLM_CHAIN на Gemini-first (credits depleted)
- НЕ використовувати Edit на українських route.ts/page.tsx
- НЕ запускати `npm install` локально без причини
