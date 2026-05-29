"use client";

import { RefObject } from "react";
import type { SourceTab, RefactorResult } from "../lib/types";

interface SourcePaneProps {
  sourceTab: SourceTab;
  setSourceTab: (tab: SourceTab) => void;
  input: string;
  setInput: (val: string) => void;
  loading: boolean;
  result: RefactorResult | null;
  fileInputRef: RefObject<HTMLInputElement>;
  onRefactor: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function SourcePane({
  sourceTab,
  setSourceTab,
  input,
  setInput,
  loading,
  result,
  fileInputRef,
  onRefactor,
  onFileUpload,
}: SourcePaneProps) {
  return (
    <section className="bg-white border border-ink-200 rounded-xl shadow-card overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-ink-200 flex items-center gap-2">
        <span className="text-sm font-semibold text-ink-800">Сирий текст</span>
        <div className="flex-1" />
        <div className="flex items-center gap-1 bg-ink-100 p-1 rounded-lg">
          {(["text", "file", "gdoc"] as const).map((tab) => (
            <button key={tab} onClick={() => setSourceTab(tab)}
              className={"px-3 py-1 text-xs font-medium rounded-md transition " +
                (sourceTab === tab ? "bg-white text-ink-900 shadow-sm" : "text-ink-600 hover:text-ink-900")}>
              {tab === "text" ? "Текст" : tab === "file" ? "Файл" : "Google Doc"}
            </button>
          ))}
        </div>
      </div>

      {sourceTab === "text" && (
        <div className="flex-1 flex flex-col">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Вставте сирий текст, нотатки або чернетку статті…"
            className="flex-1 p-4 resize-none focus:outline-none text-[14px] text-ink-800 min-h-[480px]"
            spellCheck={false}
          />
          <div className="px-4 py-3 border-t border-ink-200 flex items-center gap-3 bg-ink-50">
            <span className="text-xs text-ink-500">
              {input.trim() ? input.trim().split(/\s+/).length : 0} слів · {input.length} символів
            </span>
            <div className="flex-1" />
            <button onClick={onRefactor} disabled={loading || !input.trim()}
              className="px-4 py-2 rounded-lg bg-accent-500 hover:bg-accent-600 disabled:bg-ink-300 disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center gap-2 shadow-card transition">
              {loading ? (<><span className="spin-slow inline-block">⟳</span><span>Структурую…</span></>)
                : (<><span>✨</span><span>{result ? "Переструктурувати" : "Структурувати через AI"}</span></>)}
            </button>
          </div>
        </div>
      )}

      {sourceTab === "file" && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-sm">
            <div className="text-5xl mb-3">📎</div>
            <h3 className="text-lg font-semibold text-ink-900 mb-1">Завантажити файл</h3>
            <p className="text-sm text-ink-600 mb-4">Витягнемо текст і структуруємо у формат Outline.</p>
            <div className="text-xs text-ink-500 mb-4">.docx · .pdf · .md · .txt</div>
            <input ref={fileInputRef} type="file" accept=".txt,.md,.docx,.pdf" onChange={onFileUpload} className="hidden" id="file-upload" />
            <label htmlFor="file-upload"
              className="inline-block px-5 py-2.5 rounded-lg border border-ink-300 bg-white hover:bg-ink-50 text-ink-800 text-sm font-medium cursor-pointer">
              Обрати файл
            </label>
          </div>
        </div>
      )}

      {sourceTab === "gdoc" && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-sm">
            <div className="text-5xl mb-3">☁️</div>
            <h3 className="text-lg font-semibold text-ink-900 mb-1">Імпорт з Google Docs</h3>
            <p className="text-sm text-ink-600 mb-4">У розробці. Поки скопіюй текст і встав у вкладку "Текст".</p>
          </div>
        </div>
      )}
    </section>
  );
}
