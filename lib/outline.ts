/**
 * Outline API клієнт — search для dedup + documents.create для publish.
 */

const BASE = process.env.OUTLINE_BASE_URL?.replace(/\/+$/, "") || "";
const PUBLIC = process.env.OUTLINE_PUBLIC_URL?.replace(/\/+$/, "") || BASE.replace(/\/api$/, "");
const KEY = process.env.OUTLINE_API_KEY || "";

async function outlineRequest(path: string, body: any): Promise<any> {
  if (!BASE) throw new Error("OUTLINE_BASE_URL не задано в env");
  if (!KEY) throw new Error("OUTLINE_API_KEY не задано в env");

  const res = await fetch(`${BASE}${path.startsWith("/") ? path : `/${path}`}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Outline ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

export type OutlineDoc = {
  id: string;
  title: string;
  url: string;
  collectionId: string;
  text?: string;
  updatedAt?: string;
};

export async function outlineSearch(query: string, limit = 5): Promise<any[]> {
  const res = await outlineRequest("/documents.search", { query, limit });
  return Array.isArray(res?.data) ? res.data : [];
}

export async function outlineListCollections(): Promise<any[]> {
  const res = await outlineRequest("/collections.list", { limit: 100 });
  return Array.isArray(res?.data) ? res.data : [];
}

export async function outlineCreateDraft({
  title,
  text,
  collectionId,
}: {
  title: string;
  text: string;
  collectionId: string;
}): Promise<{ id: string; url: string }> {
  const res = await outlineRequest("/documents.create", {
    title,
    text,
    collectionId,
    publish: false,
  });
  const doc = res?.data;
  if (!doc?.id) throw new Error("Outline не повернув документ");
  return {
    id: doc.id,
    url: `${PUBLIC}${doc.url}`,
  };
}

export async function outlineGetDocument(id: string): Promise<OutlineDoc & { text: string }> {
  const res = await outlineRequest("/documents.info", { id });
  const doc = res?.data;
  if (!doc?.id) throw new Error("Документ не знайдено в Outline");
  return {
    id: doc.id,
    title: doc.title,
    url: buildPublicUrl(doc.url),
    collectionId: doc.collectionId,
    text: doc.text || "",
    updatedAt: doc.updatedAt,
  };
}

export async function outlineUpdateDocument({
  id,
  title,
  text,
}: {
  id: string;
  title: string;
  text: string;
}): Promise<{ id: string; url: string }> {
  const res = await outlineRequest("/documents.update", { id, title, text });
  const doc = res?.data;
  if (!doc?.id) throw new Error("Outline не оновив документ");
  return { id: doc.id, url: buildPublicUrl(doc.url) };
}

export function buildPublicUrl(relativeUrl: string): string {
  if (!relativeUrl) return "";
  if (/^https?:\/\//.test(relativeUrl)) return relativeUrl;
  return `${PUBLIC}${relativeUrl.startsWith("/") ? "" : "/"}${relativeUrl}`;
}
