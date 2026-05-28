/**
 * Google Drive клієнт через service account.
 * Використовується для пошуку дублікатів у робочих документах команди Selfy.
 */

import fs from "fs";
import { google } from "googleapis";

const KEY_PATH = process.env.GDRIVE_KEY_PATH || "/opt/wiki-selfy-bot/secrets/gdrive-key.json";

let _drive: any = null;
let _clientEmail: string | null = null;

function getDrive() {
  if (_drive) return _drive;
  if (!fs.existsSync(KEY_PATH)) return null;
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: KEY_PATH,
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });
    _drive = google.drive({ version: "v3", auth });
    try {
      const cred = JSON.parse(fs.readFileSync(KEY_PATH, "utf8"));
      _clientEmail = cred.client_email;
    } catch {
      /* ignore */
    }
    return _drive;
  } catch (err: any) {
    console.warn("[gdrive] init failed:", err?.message);
    return null;
  }
}

export function isGDriveAvailable(): boolean {
  return !!getDrive();
}

export function getGDriveEmail(): string | null {
  getDrive();
  return _clientEmail;
}

const MIME_FOLDER = "application/vnd.google-apps.folder";

function buildViewUrl(id: string, mimeType: string): string {
  if (mimeType === "application/vnd.google-apps.document") {
    return `https://docs.google.com/document/d/${id}/edit`;
  }
  if (mimeType === "application/vnd.google-apps.spreadsheet") {
    return `https://docs.google.com/spreadsheets/d/${id}/edit`;
  }
  return `https://drive.google.com/file/d/${id}/view`;
}

export type GDriveDup = {
  id: string;
  title: string;
  url: string;
  owner?: string;
  mimeType?: string;
  modifiedTime?: string;
};

/**
 * Пошук у Google Drive за full-text або назвою.
 * Повертає до `limit` найрелевантніших файлів (без папок).
 */
export async function gdriveSearch(query: string, limit = 5): Promise<GDriveDup[]> {
  const drive = getDrive();
  if (!drive) return [];

  const safe = String(query).slice(0, 200).replace(/'/g, "\\'");

  try {
    // Спочатку — точне співпадіння в назві (найвищий пріоритет)
    const titleRes = await drive.files.list({
      q: `name contains '${safe}' and mimeType != '${MIME_FOLDER}' and trashed = false`,
      pageSize: limit,
      fields: "files(id, name, mimeType, modifiedTime, owners(emailAddress), webViewLink)",
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      corpora: "allDrives",
      orderBy: "modifiedTime desc",
    });
    const titleFiles: any[] = titleRes.data.files || [];

    // Далі — fullText (доповнюємо до limit)
    let fullFiles: any[] = [];
    if (titleFiles.length < limit) {
      const need = limit - titleFiles.length;
      const fullRes = await drive.files.list({
        q: `fullText contains '${safe}' and mimeType != '${MIME_FOLDER}' and trashed = false`,
        pageSize: need + titleFiles.length,
        fields: "files(id, name, mimeType, modifiedTime, owners(emailAddress), webViewLink)",
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        corpora: "allDrives",
        orderBy: "modifiedTime desc",
      });
      fullFiles = (fullRes.data.files || []).filter(
        (f: any) => !titleFiles.find((t: any) => t.id === f.id),
      );
    }

    const merged = [...titleFiles, ...fullFiles].slice(0, limit);
    return merged.map((f: any) => ({
      id: f.id,
      title: f.name || "(без назви)",
      url: buildViewUrl(f.id, f.mimeType),
      owner: f.owners?.[0]?.emailAddress || undefined,
      mimeType: f.mimeType,
      modifiedTime: f.modifiedTime,
    }));
  } catch (err: any) {
    console.warn("[gdrive] search failed:", err?.message);
    return [];
  }
}
