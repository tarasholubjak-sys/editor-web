"use client";

import { TEMPLATES } from "../lib/constants";
import type { Collection } from "../lib/types";

interface FooterBarProps {
  collections: Collection[];
  selectedCollectionId: string;
  setSelectedCollectionId: (val: string) => void;
  selectedTemplate: string;
  setSelectedTemplate: (val: string) => void;
  loading: boolean;
  onClear: () => void;
  onSaveDraft: () => void;
  onPublish: () => void;
  updating?: boolean;
}

export default function FooterBar({
  collections,
  selectedCollectionId,
  setSelectedCollectionId,
  selectedTemplate,
  setSelectedTemplate,
  loading,
  onClear,
  onSaveDraft,
  onPublish,
  updating,
}: FooterBarProps) {
  return (
    <footer className="sticky bottom-0 bg-white border-t border-ink-200 shadow-soft mt-4">
      <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center gap-4 flex-wrap">
        <div className="flex flex-col">
          <span className="text-[10px] text-ink-500 uppercase tracking-wider mb-0.5">Колекція</span>
          <select value={selectedCollectionId} onChange={(e) => setSelectedCollectionId(e.target.value)}
            className="px-3 py-2 rounded-md border border-ink-200 text-sm bg-white focus:border-accent-400 focus:outline-none">
            <option value="">Авто (за типом)</option>
            {collections.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
        </div>

        <div className="flex flex-col">
          <span className="text-[10px] text-ink-500 uppercase tracking-wider mb-0.5">Шаблон</span>
          <select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)}
            className="px-3 py-2 rounded-md border border-ink-200 text-sm bg-white focus:border-accent-400 focus:outline-none">
            {TEMPLATES.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
          </select>
        </div>

        <div className="flex-1" />

        <button onClick={onClear}
          className="px-4 py-2.5 rounded-lg border border-ink-200 hover:bg-ink-50 text-ink-700 text-sm font-medium">✕ Очистити</button>
        <button onClick={onSaveDraft}
          className="px-4 py-2.5 rounded-lg border border-ink-200 hover:bg-ink-50 text-ink-700 text-sm font-medium">💾 Зберегти .md</button>
        <button onClick={onPublish} disabled={loading}
          className={"px-5 py-2.5 rounded-lg disabled:bg-ink-300 text-white text-sm font-semibold flex items-center gap-2 shadow-card " + (updating ? "bg-amber-600 hover:bg-amber-700" : "bg-accent-500 hover:bg-accent-600")}>
          {updating ? "🔄 Оновити існуючу статтю" : "📤 Опублікувати чернеткою в Outline"}
        </button>
      </div>
    </footer>
  );
}
