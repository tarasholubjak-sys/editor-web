/**
 * GET /api/tree
 *
 * Аналіз поточної структури бази знань Selfy: колекції Outline + основні GDrive файли.
 * Повертає JSON з оцінкою, дублями, прогалинами і запропонованою новою структурою.
 *
 * Кешується на 5 хвилин (in-memory) щоб не бити LLM щоразу.
 * Bypass cache: ?force=1
 */

import { NextResponse } from "next/server";
import { llmGenerate } from "@/lib/llm";
import { outlineListCollections, buildPublicUrl } from "@/lib/outline";
import { isGDriveAvailable, getGDriveEmail } from "@/lib/gdrive";
import { google } from "googleapis";
import fs from "fs";
import { createHash } from "crypto";
import { checkRate, rateKey, checkGlobalRate } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

const KEY_PATH = process.env.GDRIVE_KEY_PATH || "/opt/wiki-selfy-bot/secrets/gdrive-key.json";

type CacheEntry = { ts: number; data: any };
let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 хв

function safeJson(text: string): any {
  const cleaned = String(text).replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function listOutlineDocuments(collectionId: string, limit = 100): Promise<any[]> {
  const base = process.env.OUTLINE_BASE_URL?.replace(/\/+$/, "");
  const key = process.env.OUTLINE_API_KEY;
  if (!base || !key) return [];
  try {
    const res = await fetch(`${base}/documents.list`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        collectionId,
        limit,
        sort: "updatedAt",
        direction: "DESC",
      }),
    });
    if (!res.ok) return [];
    const j = await res.json();
    return Array.isArray(j?.data) ? j.data : [];
  } catch {
    return [];
  }
}

async function getGDriveSnapshot(limit = 80): Promise<any[]> {
  if (!fs.existsSync(KEY_PATH)) return [];
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: KEY_PATH,
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });
    const drive = google.drive({ version: "v3", auth });
    const res = await drive.files.list({
      pageSize: limit,
      fields: "files(id, name, mimeType, modifiedTime, owners(emailAddress))",
      q: "trashed = false and mimeType != 'application/vnd.google-apps.folder'",
      orderBy: "modifiedTime desc",
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      corpora: "allDrives",
    });
    return res.data.files || [];
  } catch {
    return [];
  }
}

const TREE_PROMPT = `Ти — архітектор бази знань Selfy (B2B опт дитячих товарів). Перед тобою повний знімок:

ПОТОЧНІ КОЛЕКЦІЇ OUTLINE:
{{collections}}

ВСІ ДОКУМЕНТИ В OUTLINE (по колекціях, скорочені назви):
{{outlineDocs}}

ОСНОВНІ ФАЙЛИ В GOOGLE DRIVE (ще не перенесено):
{{gdriveFiles}}

ЗАВДАННЯ — поверни ТІЛЬКИ валідний JSON цього формату:

{
  "overview": {
    "outlineCollections": 12,
    "outlineDocuments": 206,
    "gdriveFilesVisible": 1012,
    "qualityScore": 65,
    "summary": "Стисло одним реченням стан бази (наприклад: 'Структура логічна але є 4 групи дублів і 1 порожня колекція')."
  },
  "issues": [
    {
      "type": "duplicate",
      "severity": "high",
      "title": "American Club — 3 копії",
      "details": "В колекціях X, Y, Z є практично однакові статті.",
      "action": "Залишити свіжу версію, інші перенести в Архів."
    },
    {
      "type": "empty_collection",
      "severity": "medium",
      "title": "Колекція 'Фінанси' порожня",
      "details": "...",
      "action": "Наповнити з GDrive або приховати."
    },
    {
      "type": "gap",
      "severity": "high",
      "title": "Немає інструкцій для бухгалтерії",
      "details": "Менеджери натикаються на бухгалтерські процеси, але документа нема.",
      "action": "Створити нову колекцію 'Бухгалтерія' з 3-5 базових SOP."
    },
    {
      "type": "mismatch",
      "severity": "low",
      "title": "Документ X лежить не у тій колекції",
      "details": "...",
      "action": "Перенести в Y."
    }
  ],
  "duplicateGroups": [
    {
      "topic": "American Club",
      "documents": ["[Outline/Скрипти] American Club", "[Outline/Скрипти] American Club (стара)", "[Outline/Навчання] American Club"],
      "recommendation": "Merge у одну в Навчанні, інші в Архів."
    }
  ],
  "proposedStructure": [
    {
      "name": "Продажі",
      "subcollections": [
        { "name": "Скрипти", "count": 18, "moveFrom": ["Скрипти", "Навчання"] },
        { "name": "Регламенти", "count": 9, "moveFrom": ["Інструкції"] }
      ],
      "rationale": "Логічно об'єднати скрипти і регламенти продажу в одну вертикаль."
    }
  ],
  "migrationFromGDrive": [
    {
      "topic": "Алгоритм роботи з поверненнями",
      "currentLocation": "GDrive (selfyshop@gmail.com)",
      "targetCollection": "Продажі / Регламенти",
      "priority": "high"
    }
  ]
}

ПРАВИЛА:
1. qualityScore: 0-100 (% структурного порядку бази).
2. issues: 5-12 елементів, найболючіші. severity: high (одразу робити) / medium / low.
3. duplicateGroups: тільки реальні дублі (2+ документи однакової теми).
4. proposedStructure: 4-8 топ-рівневих колекцій. Враховуй що Selfy — B2B опт.
5. migrationFromGDrive: 5-10 топ-кандидатів які явно треба перенести.
6. Все українською. Без води.

Поверни ТІЛЬКИ JSON.`;

export async function GET(req: Request) {
  const key = rateKey(req);
  if (!checkRate(key, 6, 60_000) || !checkGlobalRate("tree", 12, 60_000)) {
    return NextResponse.json({ error: "Забагато запитів. Спробуй через хвилину." }, { status: 429 });
  }

  try {
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "1";

    // Кеш (bypass якщо ?force=1)
    if (!force && cache && Date.now() - cache.ts < CACHE_TTL_MS) {
      return NextResponse.json({ tree: cache.data, cached: true });
    }

    // 1. Збираємо колекції + документи з Outline
    const collections = await outlineListCollections();
    const collectionsText = collections
      .map((c: any) => `- ${c.name} (id=${c.id})`)
      .join("\n");

    // Беремо до 20 свіжих документів з кожної колекції — паралельно (12 колекцій × 1с = 1с замість 12с)
    const docsByCollection: Record<string, string[]> = {};
    const docsResults = await Promise.all(
      collections.map((c: any) =>
        listOutlineDocuments(c.id, 20)
          .then((docs) => ({ name: c.name, titles: docs.map((d: any) => d.title || "(без назви)") }))
          .catch(() => ({ name: c.name, titles: [] })),
      ),
    );
    for (const r of docsResults) {
      docsByCollection[r.name] = r.titles;
    }
    const outlineDocsText = Object.entries(docsByCollection)
      .map(([name, titles]) => {
        const list = titles.slice(0, 15).map((t) => `  • ${t}`).join("\n");
        const more = titles.length > 15 ? `\n  ... +${titles.length - 15} ще` : "";
        return `📁 ${name} (${titles.length} док):\n${list}${more}`;
      })
      .join("\n\n");

    // 2. GDrive snapshot
    const gdriveFiles = await getGDriveSnapshot(80);
    const gdriveText = gdriveFiles.length
      ? gdriveFiles
          .slice(0, 60)
          .map(
            (f: any) =>
              `• "${f.name}" (${f.owners?.[0]?.emailAddress || "?"}, ${(f.modifiedTime || "").slice(0, 10)})`,
          )
          .join("\n")
      : "(GDrive недоступний)";

    // 3. Питаємо LLM
    // callback-form: контент може містити $1/$& які String.replace інтерпретує
    const prompt = TREE_PROMPT
      .replace("{{collections}}", () => collectionsText)
      .replace("{{outlineDocs}}", () => outlineDocsText.slice(0, 18000))
      .replace("{{gdriveFiles}}", () => gdriveText.slice(0, 6000));

    const { text } = await llmGenerate({
      system: "Ти — структурний архітектор бази знань. Завжди повертай чистий валідний JSON без преамбули.",
      user: prompt,
      maxTokens: 12000,
    });

    const tree = safeJson(text);
    if (!tree) {
      // Логуємо masked-метадані щоб діагностувати без витоку контенту
      const len = String(text).length;
      const hash = createHash("sha256").update(String(text)).digest("hex").slice(0, 12);
      console.error(`[tree] Невалідний JSON: len=${len} hash=${hash} preview=${String(text).slice(0, 200)}`);
      return NextResponse.json(
        { error: "LLM не повернула валідний JSON" },
        { status: 500 },
      );
    }

    // Збагачуємо meta-даними (фактичні цифри)
    tree.overview = tree.overview || {};
    tree.overview.actualCollections = collections.length;
    tree.overview.actualDocuments = Object.values(docsByCollection).reduce(
      (s, arr) => s + arr.length,
      0,
    );
    tree.overview.actualGdriveFiles = gdriveFiles.length;
    tree.meta = {
      generatedAt: new Date().toISOString(),
      collections: collections.map((c: any) => ({
        id: c.id,
        name: c.name,
        url: buildPublicUrl(c.url || `/collection/${c.id}`),
        count: docsByCollection[c.name]?.length || 0,
      })),
    };

    cache = { ts: Date.now(), data: tree };
    return NextResponse.json({ tree, cached: false });
  } catch (err: any) {
    console.error("[tree] error:", err);
    return NextResponse.json({ error: err.message || "Помилка" }, { status: 500 });
  }
}
