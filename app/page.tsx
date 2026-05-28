"use client";

import { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type DupCandidate = {
  id: string;
  title: string;
  url: string;
  matchScore: number;
};

type RefactorResult = {
  markdown: string;
  type: string;
  duplicates?: DupCandidate[];
  recommendation?: string;
};

const SAMPLE_INPUT = `АЛГОРИТМ РОБОТИ З ПОВЕРНЕННЯМИ

Типи повернень: - брак; - розпаровки; - не сподобалось/не підійшло; - відправлено на огляд

Процес опрацювання браків:
1. Звернення клієнта
2. Детальний аналіз звернення клієнта
3. Отримати відео та фото !!!!!!!
4. Якщо після аналізу наданих фото та відео ви оцінюєте, що клієнту можна запропонувати знижку - тоді обговорюєте цей момент з клієнтом. МЕНЕДЖЕР САМОСТІЙНО ПРИЙМАЄ РІШЕННЯ ЩОДО ЗНИЖКИ від 10 до 30%.
5. Якщо клієнт відмовляється - оформляємо повернення в 1С.

* Розпаровки та браки по ВАЛДІ - ПОВЕРТАЄМО ЗАВЖДИ ДО НАС.
* Інші бренди - надсилаєте в чат в Телеграмі Браки/Розпаровки взуття.

Терміни повернення: до 3-х днів від дати звернення.
Оплата за повернення: у випадку браків - Легке повернення. У випадку ініціативи клієнта - оплату бере на себе клієнт.
Повернення коштів: тільки після фізичного огляду на складі (1-3 дні).`;

export default function HomePage() {
  const [input, setInput] = useState<string>("");
  const [result, setResult] = useState<RefactorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"preview" | "raw">("preview");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRefactor = async () => {
    if (!input.trim()) {
      setError("Введи сирий текст або завантаж файл");
      return;
    }
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/refactor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: input }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Помилка ${res.status}`);
      }
      const data: RefactorResult = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Невідома помилка");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Не вдалось прочитати файл");
      const { text } = await res.json();
      setInput(text);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handlePublish = async () => {
    if (!result?.markdown) return;
    if (!confirm("Опублікувати як чернетку в Outline?")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown: result.markdown, type: result.type }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Помилка публікації");
      }
      const { url } = await res.json();
      alert(`✅ Чернетка створена!\n\nВідкрий в Outline:\n${url}`);
    } catch (err: any) {
      alert(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (result?.markdown) {
      navigator.clipboard.writeText(result.markdown);
      alert("Markdown скопійовано в буфер!");
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-accent-500 rounded-lg flex items-center justify-center text-white font-bold text-lg">
              S
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Selfy Knowledge Editor</h1>
              <p className="text-xs text-slate-500">AI-редактор бази знань</p>
            </div>
          </div>
          <a
            href="https://wiki.selfy.com.ua"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            ↗ Перейти в Outline
          </a>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6">
        {/* Toolbar */}
        <div className="bg-white rounded-lg border border-border p-4 mb-4 flex flex-wrap gap-3 items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.docx,.pdf"
            onChange={handleFileUpload}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="cursor-pointer bg-white border border-border hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2"
          >
            📎 Завантажити файл
          </label>
          <button
            onClick={() => setInput(SAMPLE_INPUT)}
            className="text-sm text-slate-500 hover:text-primary-600 underline"
          >
            Вставити приклад
          </button>
          <div className="flex-1" />
          <button
            onClick={handleRefactor}
            disabled={loading || !input.trim()}
            className="bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 text-white px-5 py-2 rounded-md text-sm font-semibold flex items-center gap-2"
          >
            {loading ? "⏳ Обробка..." : "✨ Переписати"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-3 mb-4 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* Two-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Input */}
          <div className="bg-white border border-border rounded-lg overflow-hidden flex flex-col">
            <div className="bg-slate-50 border-b border-border px-4 py-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">📥 Сирий текст</h2>
              <span className="text-xs text-slate-500">{input.length} символів</span>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Вставте сирий текст документа сюди... або завантажте файл вгорі."
              className="flex-1 p-4 resize-none focus:outline-none text-sm font-mono text-slate-800 min-h-[500px]"
            />
          </div>

          {/* Preview */}
          <div className="bg-white border border-border rounded-lg overflow-hidden flex flex-col">
            <div className="bg-slate-50 border-b border-border px-4 py-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">
                📄 Результат {result?.type && <span className="text-xs text-primary-600 ml-2">[{result.type}]</span>}
              </h2>
              {result?.markdown && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setPreviewMode(previewMode === "preview" ? "raw" : "preview")}
                    className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded"
                  >
                    {previewMode === "preview" ? "📝 Markdown" : "👁️ Preview"}
                  </button>
                  <button
                    onClick={handleCopy}
                    className="text-xs px-2 py-1 bg-primary-50 hover:bg-primary-100 text-primary-700 rounded"
                  >
                    📋 Копіювати
                  </button>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-auto p-6 min-h-[500px]">
              {!result && !loading && (
                <div className="text-center text-slate-400 mt-20 text-sm">
                  Тут зявиться структурована версія документа.
                </div>
              )}
              {loading && (
                <div className="text-center text-slate-500 mt-20 text-sm">
                  <div className="inline-block animate-spin text-2xl mb-2">⏳</div>
                  <div>AI переписує документ за стандартом Selfy...</div>
                  <div className="text-xs text-slate-400 mt-2">10-30 секунд</div>
                </div>
              )}
              {result?.markdown &&
                (previewMode === "preview" ? (
                  <div className="prose-selfy">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.markdown}</ReactMarkdown>
                  </div>
                ) : (
                  <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap">{result.markdown}</pre>
                ))}
            </div>
          </div>
        </div>

        {/* Duplicates block */}
        {result?.duplicates && result.duplicates.length > 0 && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h3 className="font-semibold text-amber-900 mb-2">🔍 Знайдені схожі статті в Outline:</h3>
            <ul className="space-y-1 text-sm">
              {result.duplicates.map((d) => (
                <li key={d.id}>
                  <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-primary-600 underline">
                    {d.title}
                  </a>
                  <span className="text-amber-700 ml-2">— {Math.round(d.matchScore * 100)}% збіг</span>
                </li>
              ))}
            </ul>
            {result.recommendation && (
              <p className="mt-3 text-sm text-amber-900 font-medium">💡 {result.recommendation}</p>
            )}
          </div>
        )}

        {/* Publish button */}
        {result?.markdown && (
          <div className="mt-4 flex justify-end gap-3">
            <button
              onClick={() => {
                setInput("");
                setResult(null);
                setError(null);
              }}
              className="px-5 py-2 border border-border text-slate-700 rounded-md hover:bg-slate-50 text-sm"
            >
              ✕ Очистити
            </button>
            <button
              onClick={handlePublish}
              disabled={loading}
              className="bg-accent-500 hover:bg-accent-600 disabled:bg-slate-300 text-white px-6 py-2 rounded-md text-sm font-semibold"
            >
              📤 Опублікувати чернеткою в Outline
            </button>
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-border py-4 mt-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-xs text-slate-500">
          Selfy © 2026 · Бета-версія редактора
        </div>
      </footer>
    </div>
  );
}
