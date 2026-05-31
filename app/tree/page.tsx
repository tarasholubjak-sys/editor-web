"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Issue = {
  type: string;
  severity: "high" | "medium" | "low";
  title: string;
  details: string;
  action: string;
};

type DuplicateGroup = {
  topic: string;
  documents: string[];
  recommendation: string;
};

type ProposedCollection = {
  name: string;
  subcollections?: Array<{ name: string; count: number; moveFrom?: string[] }>;
  rationale?: string;
};

type Migration = {
  topic: string;
  currentLocation: string;
  targetCollection: string;
  priority: "high" | "medium" | "low";
};

type TreeResult = {
  overview: {
    outlineCollections: number;
    outlineDocuments: number;
    gdriveFilesVisible: number;
    qualityScore: number;
    summary: string;
    actualCollections?: number;
    actualDocuments?: number;
    actualGdriveFiles?: number;
  };
  issues: Issue[];
  duplicateGroups: DuplicateGroup[];
  proposedStructure: ProposedCollection[];
  migrationFromGDrive: Migration[];
  meta?: {
    generatedAt: string;
    collections: Array<{ id: string; name: string; url: string; count: number }>;
  };
};

// Tailwind не вміє динамічні класи (border-${x}-500) — тримаємо повні рядки
const SEV = {
  high: { icon: "🔴", border: "border-red-500", bg: "bg-red-50/50" },
  medium: { icon: "🟡", border: "border-amber-500", bg: "bg-amber-50/50" },
  low: { icon: "🔵", border: "border-blue-500", bg: "bg-blue-50/50" },
} as const;

export default function TreePage() {
  const [tree, setTree] = useState<TreeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [stepText, setStepText] = useState("Готую аналіз бази…");

  const fetchTree = async () => {
    setLoading(true);
    setError(null);
    let step = 0;
    const steps = [
      "Збираю колекції з Outline…",
      "Збираю файли з Google Drive…",
      "Шукаю дублікати між колекціями…",
      "AI аналізує структуру і прогалини…",
      "Формую рекомендації…",
    ];
    const iv = setInterval(() => {
      step++;
      if (steps[step]) setStepText(steps[step]);
    }, 5000);
    try {
      const res = await fetch("/api/tree");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Помилка");
      setTree(data.tree);
      setCached(!!data.cached);
    } catch (err: any) {
      setError(err.message);
    } finally {
      clearInterval(iv);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTree();
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-ink-200 sticky top-0 z-30">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-3 flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-accent-500 to-accent-700 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-card">S</div>
            <div className="leading-tight">
              <div className="text-[15px] font-bold text-ink-900">
                Selfy <span className="text-ink-500 font-medium">Knowledge Editor</span>
              </div>
              <div className="text-[11px] text-ink-500">AI-редактор бази знань</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-ink-500 ml-4">
            <span>›</span>
            <span className="font-semibold text-ink-800">Аналіз бази</span>
          </div>
          <div className="flex-1" />
          <Link href="/" className="text-sm text-accent-600 hover:text-accent-700 font-medium">
            ← Назад до редактора
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-5">
        <div className="mb-5 flex items-center gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-ink-900">🌳 Архітектура бази знань</h1>
            <p className="text-sm text-ink-600 mt-1">
              AI-аналіз поточної структури Outline + Google Drive
            </p>
          </div>
          <div className="flex-1" />
          {cached && (
            <span className="text-xs text-ink-500 italic">⏱ кешовано (5 хв)</span>
          )}
          <button
            onClick={fetchTree}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-accent-500 hover:bg-accent-600 disabled:bg-ink-300 text-white text-sm font-semibold flex items-center gap-2 shadow-card"
          >
            {loading ? "⟳ Аналізую…" : "🔄 Оновити аналіз"}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 mb-5">
            ⚠️ {error}
          </div>
        )}

        {loading && !tree && (
          <div className="bg-white border border-ink-200 rounded-xl shadow-card p-10 text-center">
            <div className="ai-orb mx-auto mb-5" />
            <div className="text-base font-semibold text-ink-900 mb-1">Аналізую базу знань…</div>
            <div className="text-sm text-ink-600">{stepText}</div>
            <div className="text-xs text-ink-400 mt-3">Зазвичай 30-60 секунд</div>
          </div>
        )}

        {tree && (
          <>
            {/* Overview */}
            <div className="bg-gradient-to-br from-purple-50 via-white to-accent-50 border border-purple-200 rounded-xl shadow-card p-5 mb-5">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-500 font-bold mb-1">Колекцій в Outline</div>
                  <div className="text-3xl font-bold text-ink-900">{tree.overview.actualCollections ?? tree.overview.outlineCollections}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-500 font-bold mb-1">Документів</div>
                  <div className="text-3xl font-bold text-ink-900">{tree.overview.actualDocuments ?? tree.overview.outlineDocuments}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-500 font-bold mb-1">GDrive файлів</div>
                  <div className="text-3xl font-bold text-ink-900">{tree.overview.actualGdriveFiles ?? tree.overview.gdriveFilesVisible}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-500 font-bold mb-1">Якість структури</div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-ink-200 rounded-full overflow-hidden">
                      <div className={"h-full " + (tree.overview.qualityScore > 75 ? "bg-emerald-500" : tree.overview.qualityScore > 50 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${tree.overview.qualityScore}%` }} />
                    </div>
                    <span className="text-2xl font-bold text-ink-900">{tree.overview.qualityScore}%</span>
                  </div>
                </div>
              </div>
              {tree.overview.summary && (
                <div className="mt-4 p-3 bg-white/60 border border-purple-100 rounded-lg">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-700 mr-2">📋 Висновок</span>
                  <span className="text-sm text-ink-800">{tree.overview.summary}</span>
                </div>
              )}
            </div>

            {/* 2 колонки: Проблеми + Запропонована структура */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
              {/* Issues */}
              <section className="bg-white border border-ink-200 rounded-xl shadow-card overflow-hidden">
                <div className="px-4 py-3 border-b border-ink-200 flex items-center gap-2 bg-ink-50">
                  <span className="text-base">⚠️</span>
                  <span className="text-sm font-bold text-ink-900">Виявлені проблеми</span>
                  <span className="text-xs text-ink-500 ml-2">{tree.issues?.length || 0}</span>
                </div>
                <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
                  {tree.issues?.map((iss, i) => {
                    const sev = SEV[iss.severity] || SEV.low;
                    return (
                      <div key={i} className={`border-l-4 ${sev.border} ${sev.bg} rounded p-3`}>
                        <div className="flex items-start gap-2 mb-1">
                          <span className="text-base">{sev.icon}</span>
                          <div className="flex-1">
                            <div className="text-sm font-bold text-ink-900">{iss.title}</div>
                            <div className="text-[10px] uppercase tracking-wider text-ink-500 mt-0.5">
                              {iss.type === "duplicate" ? "Дубль" :
                               iss.type === "empty_collection" ? "Порожня колекція" :
                               iss.type === "gap" ? "Прогалина" :
                               iss.type === "mismatch" ? "Не в тій колекції" : iss.type}
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-ink-700 mb-2 ml-7">{iss.details}</div>
                        <div className="ml-7 p-2 bg-white border border-ink-200 rounded text-xs text-ink-800">
                          <span className="text-accent-600 font-semibold">→ Дія:</span> {iss.action}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Proposed Structure */}
              <section className="bg-white border border-ink-200 rounded-xl shadow-card overflow-hidden">
                <div className="px-4 py-3 border-b border-ink-200 flex items-center gap-2 bg-ink-50">
                  <span className="text-base">🌲</span>
                  <span className="text-sm font-bold text-ink-900">Запропонована структура</span>
                </div>
                <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
                  {tree.proposedStructure?.map((c, i) => (
                    <div key={i} className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                      <div className="font-bold text-purple-900 mb-1">📁 {c.name}</div>
                      {c.rationale && <div className="text-xs text-ink-600 mb-2 italic">{c.rationale}</div>}
                      {c.subcollections && c.subcollections.length > 0 && (
                        <div className="space-y-1 ml-3">
                          {c.subcollections.map((sub, j) => (
                            <div key={j} className="flex items-center gap-2 text-sm">
                              <span className="text-purple-400">└</span>
                              <span className="text-ink-800">{sub.name}</span>
                              <span className="text-xs text-ink-500">({sub.count})</span>
                              {sub.moveFrom && sub.moveFrom.length > 0 && (
                                <span className="text-[10px] text-ink-500 italic">
                                  ← з {sub.moveFrom.join(", ")}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Duplicate Groups */}
            {tree.duplicateGroups && tree.duplicateGroups.length > 0 && (
              <section className="bg-white border border-amber-200 rounded-xl shadow-card overflow-hidden mb-5">
                <div className="px-4 py-3 border-b border-amber-200 flex items-center gap-2 bg-amber-50">
                  <span className="text-base">🔁</span>
                  <span className="text-sm font-bold text-ink-900">Групи дублікатів</span>
                  <span className="text-xs text-amber-700 ml-2">{tree.duplicateGroups.length}</span>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {tree.duplicateGroups.map((g, i) => (
                    <div key={i} className="bg-amber-50/50 border border-amber-200 rounded-lg p-3">
                      <div className="font-bold text-ink-900 mb-2">{g.topic}</div>
                      <ul className="space-y-1 text-xs text-ink-700 mb-2">
                        {g.documents.map((d, j) => (
                          <li key={j} className="flex items-start gap-1"><span>•</span><span>{d}</span></li>
                        ))}
                      </ul>
                      <div className="p-2 bg-white border border-amber-200 rounded text-xs">
                        <span className="text-amber-700 font-semibold">→</span> {g.recommendation}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Migration plan */}
            {tree.migrationFromGDrive && tree.migrationFromGDrive.length > 0 && (
              <section className="bg-white border border-blue-200 rounded-xl shadow-card overflow-hidden mb-5">
                <div className="px-4 py-3 border-b border-blue-200 flex items-center gap-2 bg-blue-50">
                  <span className="text-base">📦</span>
                  <span className="text-sm font-bold text-ink-900">План міграції з Google Drive</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-ink-50 text-xs text-ink-600 uppercase">
                      <tr>
                        <th className="text-left px-4 py-2">Пріоритет</th>
                        <th className="text-left px-4 py-2">Тема</th>
                        <th className="text-left px-4 py-2">Зараз</th>
                        <th className="text-left px-4 py-2">→ Куди</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tree.migrationFromGDrive.map((m, i) => (
                        <tr key={i} className="border-t border-ink-200">
                          <td className="px-4 py-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              m.priority === "high" ? "bg-red-100 text-red-700" :
                              m.priority === "medium" ? "bg-amber-100 text-amber-700" :
                              "bg-blue-100 text-blue-700"
                            }`}>
                              {m.priority}
                            </span>
                          </td>
                          <td className="px-4 py-2 font-semibold text-ink-900">{m.topic}</td>
                          <td className="px-4 py-2 text-ink-600 text-xs">{m.currentLocation}</td>
                          <td className="px-4 py-2 text-purple-700 font-medium">{m.targetCollection}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Поточні колекції */}
            {tree.meta?.collections && (
              <section className="bg-white border border-ink-200 rounded-xl shadow-card overflow-hidden">
                <div className="px-4 py-3 border-b border-ink-200 flex items-center gap-2 bg-ink-50">
                  <span className="text-base">📂</span>
                  <span className="text-sm font-bold text-ink-900">Поточні колекції Outline</span>
                </div>
                <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                  {tree.meta.collections.map((c, i) => (
                    <a
                      key={i}
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-ink-50 hover:bg-accent-50 rounded-lg border border-ink-200 text-sm flex items-center justify-between group transition"
                    >
                      <span className="text-ink-800 group-hover:text-accent-700 font-medium truncate">{c.name}</span>
                      <span className="text-xs text-ink-500 ml-2">{c.count}</span>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {tree.meta?.generatedAt && (
              <div className="text-xs text-ink-400 text-center mt-5">
                Згенеровано {new Date(tree.meta.generatedAt).toLocaleString("uk-UA")}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}