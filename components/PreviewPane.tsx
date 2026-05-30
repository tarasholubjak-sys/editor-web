"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { RefactorResult } from "../lib/types";

interface PreviewPaneProps {
  result: RefactorResult | null;
  loading: boolean;
  aiStep: string;
  title: string;
  setTitle: (val: string) => void;
  onCopy: () => void;
  onMarkdownChange: (md: string) => void;
}

export default function PreviewPane({
  result,
  loading,
  aiStep,
  title,
  setTitle,
  onCopy,
  onMarkdownChange,
}: PreviewPaneProps) {
  const [editing, setEditing] = useState(false);

  return (
    <section className="bg-white border border-ink-200 rounded-xl shadow-card overflow-hidden flex flex-col relative">
      <div className="px-4 py-3 border-b border-ink-200 flex items-center gap-2">
        <span className="text-sm font-semibold text-ink-800">
          {editing ? "Редагування markdown" : "Preview · як буде в Outline"}
        </span>
        <div className="flex-1" />
        {result?.markdown && (
          <>
            <button
              onClick={() => setEditing((v) => !v)}
              className={`text-xs px-2.5 py-1 rounded-md font-medium ${
                editing
                  ? "bg-accent-500 text-white hover:bg-accent-600"
                  : "bg-ink-100 hover:bg-ink-200 text-ink-700"
              }`}
            >
              {editing ? "👁 Перегляд" : "✏️ Редагувати"}
            </button>
            <button
              onClick={onCopy}
              className="text-xs px-2.5 py-1 rounded-md bg-ink-100 hover:bg-ink-200 text-ink-700 font-medium"
            >
              📋 Копіювати markdown
            </button>
          </>
        )}
      </div>

      {loading && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-10 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <div className="ai-orb mx-auto mb-5" />
            <div className="text-base font-semibold text-ink-900 mb-1">AI структурує документ</div>
            <div className="text-sm text-ink-600">{aiStep}</div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto min-h-[520px]">
        {!result && !loading && (
          <div className="h-full flex flex-col items-center justify-center text-center text-ink-400 p-8">
            <div className="text-5xl mb-3 opacity-30">📄</div>
            <p className="text-sm">Введіть текст ліворуч і натисніть «Структурувати через AI».</p>
          </div>
        )}

        {result?.markdown && !loading && editing && (
          <div className="p-4 h-full flex flex-col">
            <p className="text-xs text-ink-500 mb-2">
              Редагуй markdown напряму (включно з заголовком — перший рядок «# …»). Зміни одразу
              підуть у публікацію та збереження.
            </p>
            <textarea
              value={result.markdown}
              onChange={(e) => onMarkdownChange(e.target.value)}
              spellCheck={false}
              className="w-full flex-1 min-h-[460px] font-mono text-[13px] leading-relaxed text-ink-800 bg-ink-50 border border-ink-200 rounded-lg p-3 resize-none focus:outline-none focus:border-accent-300"
            />
          </div>
        )}

        {result?.markdown && !loading && !editing && (
          <article className="p-8">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-[28px] font-bold text-ink-900 mb-4 focus:outline-none border-b-2 border-transparent focus:border-accent-300"
            />
            <div className="prose-outline">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {result.markdown.replace(/^#\s+.+\n+/, "")}
              </ReactMarkdown>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}
