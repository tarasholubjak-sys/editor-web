"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type DupCandidate = {
  source?: "outline" | "gdrive";
  id: string;
  title: string;
  collection?: string;
  url: string;
  updated?: string;
  matchScore: number;
};

type RefactorResult = {
  markdown: string;
  type: string;
  duplicates?: DupCandidate[];
  recommendation?: string;
};

type LanguageIssue = {
  type: string;
  found: string;
  suggestion: string;
  severity: "low" | "medium" | "high";
};

type AnalysisResult = {
  overview: {
    type: string;
    audience: string;
    coverage: number;
    qualityScore: number;
    summary: string;
  };
  relatedDocs: Array<{
    title: string;
    relationship: string;
    recommendation: string;
  }>;
  recommendations: {
    toAdd: string[];
    toImprove: string[];
    gaps: string[];
  };
  nextActions: Array<{
    label: string;
    type: string;
    rationale?: string;
  }>;
  languageQuality?: {
    score: number;
    verdict: string;
    issues: LanguageIssue[];
  };
};

type Collection = { id: string; name: string };

const AI_STEPS = [
  "Аналізую структуру тексту…",
  "Виділяю заголовки та кроки…",
  "Форматую списки й виноски…",
  "Перевіряю дублікати в Outline та Google Drive…",
];

const TEMPLATES = [
  { id: "sop", name: "SOP / Регламент" },
  { id: "script", name: "Скрипт продажу" },
  { id: "faq", name: "FAQ" },
  { id: "onboarding", name: "Онбординг" },
  { id: "policy", name: "Політика" },
  { id: "product", name: "Опис бренду" },
];

export default function HomePage() {
  const [sourceTab, setSourceTab] = useState<"text" | "file" | "gdoc">("text");
  const [input, setInput] = useState<string>("");
  const [result, setResult] = useState<RefactorResult | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aiStep, setAiStep] = useState<string>(AI_STEPS[0]);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0].id);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("");
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/collections").then(async (r) => {
      if (!r.ok) return;
      const data = await r.json();
      if (Array.isArray(data.collections)) setCollections(data.collections);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!loading) return;
    let i = 0;
    setAiStep(AI_STEPS[0]);
    const id = setInterval(() => { i++; if (AI_STEPS[i]) setAiStep(AI_STEPS[i]); }, 1800);
    return () => clearInterval(id);
  }, [loading]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const extractTitle = (md: string): string => {
    const m = md.match(/^#\s+(.+?)$/m);
    return m ? m[1].trim() : "Без назви";
  };

  // Викликати AI-аналіз в фоні після refactor
  const runAnalysis = async (md: string, dupes: DupCandidate[] | undefined, type: string) => {
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown: md, duplicates: dupes || [], type }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (data.analysis) setAnalysis(data.analysis);
    } catch (err) {
      console.warn("Analyze failed:", err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRefactor = async () => {
    if (loading) return; // захист від подвійного кліку
    if (!input.trim()) {
      setError("Введи сирий текст або завантаж файл");
      return;
    }
    setError(null);
    setLoading(true);
    setResult(null);
    setAnalysis(null);
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
      setTitle(extractTitle(data.markdown));
      if (data.type) setSelectedTemplate(data.type);
      runAnalysis(data.markdown, data.duplicates, data.type);
    } catch (err: any) {
      setError(err.message || "Невідома помилка");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (loading) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не вдалось прочитати файл");
      setInput(data.text);
      setSourceTab("text");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handlePublish = async () => {
    if (loading) return; // захист від подвійного кліку → дублі в Outline
    if (!result?.markdown) return;
    if (!confirm(`Опублікувати "${title}" як чернетку в Outline?`)) return;
    setLoading(true);
    try {
      // callback-form щоб title з $1/$& не інтерпретувався як backreference
      const md = result.markdown.replace(/^#\s+.+$/m, () => `# ${title}`);
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markdown: md,
          type: selectedTemplate,
          collectionId: selectedCollectionId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Помилка публікації");
      showToast(`Чернетку створено в Outline`);
      window.open(data.url, "_blank");
    } catch (err: any) {
      alert(`Помилка: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = () => {
    if (!result?.markdown) return;
    const blob = new Blob([result.markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || "draft"}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Завантажую markdown файл");
  };

  // безпечна копія: clipboard API падає на HTTP/non-secure context
  const safeCopy = async (text: string, okMsg: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        showToast(okMsg);
        return;
      }
      throw new Error("Clipboard API недоступний");
    } catch {
      // fallback через textarea
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        showToast(okMsg);
      } catch {
        showToast("Не вдалось скопіювати — виділи і Ctrl+C");
      }
    }
  };

  const handleCopy = () => {
    if (result?.markdown) safeCopy(result.markdown, "Markdown у буфері");
  };

  const handleActionClick = (label: string, rationale?: string) => {
    const prompt = rationale
      ? `${label}\n\nКонтекст: ${rationale}`
      : label;
    safeCopy(prompt, `Скопійовано: "${label.slice(0, 30)}..."`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Topbar */}
      <header className="bg-white border-b border-ink-200 sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center gap-6">
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
            <span>›</span><span>Чернетки</span><span>›</span>
            <span className="font-semibold text-ink-800">Нова стаття</span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Синхронізовано з Outline + GDrive
          </div>
          <a href="/tree" className="text-sm text-purple-600 hover:text-purple-700 font-semibold">
            🌳 Аналіз бази
          </a>
          <a href="https://wiki.selfy.com.ua" target="_blank" rel="noopener noreferrer"
            className="text-sm text-accent-600 hover:text-accent-700 font-medium">↗ Outline</a>
        </div>
      </header>

      <main className="flex-1 max-w-[1400px] mx-auto w-full px-6 py-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-2.5 mb-4 text-sm flex items-center gap-2">
            <span>⚠️</span><span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800">✕</button>
          </div>
        )}

        {/* Дві колонки */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Ліва — сирий */}
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
                  <button onClick={handleRefactor} disabled={loading || !input.trim()}
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
                  <input ref={fileInputRef} type="file" accept=".txt,.md,.docx,.pdf" onChange={handleFileUpload} className="hidden" id="file-upload" />
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

          {/* Права — Preview */}
          <section className="bg-white border border-ink-200 rounded-xl shadow-card overflow-hidden flex flex-col relative">
            <div className="px-4 py-3 border-b border-ink-200 flex items-center gap-2">
              <span className="text-sm font-semibold text-ink-800">Preview · як буде в Outline</span>
              <div className="flex-1" />
              {result?.markdown && (
                <button onClick={handleCopy}
                  className="text-xs px-2.5 py-1 rounded-md bg-ink-100 hover:bg-ink-200 text-ink-700 font-medium">📋 Копіювати markdown</button>
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

              {result?.markdown && !loading && (
                <article className="p-8">
                  <input value={title} onChange={(e) => setTitle(e.target.value)}
                    className="w-full text-[28px] font-bold text-ink-900 mb-4 focus:outline-none border-b-2 border-transparent focus:border-accent-300" />
                  <div className="prose-outline">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {result.markdown.replace(/^#\s+.+\n+/, "")}
                    </ReactMarkdown>
                  </div>
                </article>
              )}
            </div>
          </section>
        </div>

        {/* Блок дублікатів */}
        {result?.duplicates && result.duplicates.length > 0 && (
          <div className="mt-4 bg-white border border-ink-200 rounded-xl shadow-card overflow-hidden">
            <div className="px-4 py-3 border-b border-ink-200 flex items-center gap-2 flex-wrap">
              <span className="text-base">🔍</span>
              <span className="text-sm font-semibold text-ink-800">Перевірка дублікатів</span>
              <span className="text-xs text-ink-500 ml-2">{result.duplicates.length} схожих в Outline + Google Drive</span>
              {result.recommendation && (
                <span className="ml-auto text-xs text-amber-700 font-medium">💡 {result.recommendation}</span>
              )}
            </div>
            <div className="p-4 space-y-3">
              {result.duplicates.map((d) => {
                const pct = Math.round(d.matchScore * 100);
                const isFlag = d.matchScore >= 0.6;
                const isGdrive = d.source === "gdrive";
                return (
                  <div key={`${d.source || "outline"}-${d.id}`}
                    className={"rounded-lg border p-4 " + (isFlag ? "bg-amber-50 border-amber-300" : "bg-ink-50 border-ink-200")}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={"inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider " +
                            (isGdrive ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800")}>
                            {isGdrive ? "📂 Google Drive" : "📚 Outline"}
                          </span>
                          <a href={d.url} target="_blank" rel="noopener noreferrer"
                            className="text-sm font-semibold text-ink-900 hover:text-accent-600">{d.title}</a>
                          {isFlag && <span className="text-amber-700 text-xs">⚠️ висока схожість</span>}
                        </div>
                        {(d.collection || d.updated) && (
                          <div className="text-xs text-ink-500 mb-2">
                            {d.collection}{d.collection && d.updated && " · "}
                            {d.updated && `оновлено ${d.updated}`}
                          </div>
                        )}
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-1.5 bg-ink-200 rounded-full overflow-hidden">
                            <div className={"h-full " + (isFlag ? "bg-amber-500" : "bg-ink-400")} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-ink-700 min-w-[36px] text-right">{pct}%</span>
                        </div>
                      </div>
                    </div>

                    {isFlag && (
                      <div className="mt-3 pt-3 border-t border-amber-200 flex items-center gap-3">
                        <span className="text-sm text-amber-900 flex-1">
                          {isGdrive
                            ? <>📂 Цей матеріал лежить у Google Drive — варто <b>перенести в Outline</b> і об'єднати.</>
                            : <>🔄 Рекомендуємо <b>оновити існуючу статтю</b> в Outline замість створення нової.</>}
                        </span>
                        <a href={d.url} target="_blank" rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-md bg-white border border-amber-300 hover:bg-amber-100 text-xs font-medium text-amber-900">
                          {isGdrive ? "Відкрити в Google Drive" : "Відкрити в Outline"}
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Блок AI-Аналіз */}
        {(analyzing || analysis) && (
          <div className="mt-4 bg-gradient-to-br from-purple-50 via-white to-accent-50 border border-purple-200 rounded-xl shadow-card overflow-hidden">
            <div className="px-5 py-3 border-b border-purple-200 flex items-center gap-2 bg-white/60">
              <span className="text-base">🧠</span>
              <span className="text-sm font-bold text-ink-900">AI-Аналіз документа</span>
              {analyzing && (
                <span className="text-xs text-purple-600 ml-2 flex items-center gap-1">
                  <span className="spin-slow inline-block">⟳</span> аналізую…
                </span>
              )}
              {analysis && (
                <span className="ml-auto text-xs text-ink-500 italic">{analysis.overview.summary}</span>
              )}
            </div>

            {analyzing && !analysis && (
              <div className="p-8 text-center text-ink-500 text-sm">
                <div className="ai-orb mx-auto mb-3" />
                Аналізую покриття теми, шукаю прогалини в базі, формую рекомендації…
              </div>
            )}

            {analysis && (
              <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Лівий — Overview */}
                <div className="space-y-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-ink-500 font-bold mb-1">📊 Про документ</div>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between"><span className="text-ink-600">Тип:</span><span className="font-semibold text-ink-900">{analysis.overview.type}</span></div>
                      <div className="flex justify-between"><span className="text-ink-600">Аудиторія:</span><span className="font-semibold text-ink-900 text-right max-w-[60%]">{analysis.overview.audience}</span></div>
                      <div className="flex justify-between"><span className="text-ink-600">Покриття:</span>
                        <span className="font-semibold">{"⭐".repeat(analysis.overview.coverage)}<span className="text-ink-300">{"⭐".repeat(5 - analysis.overview.coverage)}</span></span>
                      </div>
                      <div className="flex justify-between items-center"><span className="text-ink-600">Якість:</span>
                        <span className="flex items-center gap-2 font-semibold">
                          <div className="w-16 h-1.5 bg-ink-200 rounded-full overflow-hidden">
                            <div className={"h-full " + (analysis.overview.qualityScore > 75 ? "bg-emerald-500" : analysis.overview.qualityScore > 50 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${analysis.overview.qualityScore}%` }} />
                          </div>
                          <span className="text-ink-900">{analysis.overview.qualityScore}%</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {analysis.relatedDocs && analysis.relatedDocs.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-ink-500 font-bold mb-2">🧩 Дотичні документи</div>
                      <div className="space-y-2 text-sm">
                        {analysis.relatedDocs.map((rd, i) => (
                          <div key={i} className="bg-white border border-purple-100 rounded-md p-2.5">
                            <div className="font-semibold text-ink-900 text-xs mb-0.5">📄 {rd.title}</div>
                            <div className="text-xs text-ink-600 mb-1">{rd.relationship}</div>
                            <div className="text-xs text-purple-700">→ {rd.recommendation}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Центр — Рекомендації */}
                <div className="space-y-3">
                  <div className="text-[10px] uppercase tracking-wider text-ink-500 font-bold mb-1">✨ Рекомендації</div>

                  {analysis.recommendations.toAdd && analysis.recommendations.toAdd.length > 0 && (
                    <div className="bg-white border border-emerald-200 rounded-lg p-3">
                      <div className="text-xs font-bold text-emerald-700 mb-2">➕ ДОДАТИ</div>
                      <ul className="space-y-1.5 text-sm text-ink-800">
                        {analysis.recommendations.toAdd.map((t, i) => (
                          <li key={i} className="flex gap-2"><span className="text-emerald-600">•</span><span>{t}</span></li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {analysis.recommendations.toImprove && analysis.recommendations.toImprove.length > 0 && (
                    <div className="bg-white border border-amber-200 rounded-lg p-3">
                      <div className="text-xs font-bold text-amber-700 mb-2">🔧 ПОКРАЩИТИ</div>
                      <ul className="space-y-1.5 text-sm text-ink-800">
                        {analysis.recommendations.toImprove.map((t, i) => (
                          <li key={i} className="flex gap-2"><span className="text-amber-600">•</span><span>{t}</span></li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {analysis.recommendations.gaps && analysis.recommendations.gaps.length > 0 && (
                    <div className="bg-white border border-red-200 rounded-lg p-3">
                      <div className="text-xs font-bold text-red-700 mb-2">⚠️ ПРОГАЛИНИ В БАЗІ</div>
                      <ul className="space-y-1.5 text-sm text-ink-800">
                        {analysis.recommendations.gaps.map((t, i) => (
                          <li key={i} className="flex gap-2"><span className="text-red-600">•</span><span>{t}</span></li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Правий — Наступні дії */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-500 font-bold mb-2">🎯 Наступні дії</div>
                  <div className="space-y-2">
                    {analysis.nextActions && analysis.nextActions.map((a, i) => (
                      <button key={i} onClick={() => handleActionClick(a.label, a.rationale)}
                        className="w-full text-left p-3 bg-white hover:bg-purple-50 border border-purple-200 rounded-lg transition group">
                        <div className="flex items-start gap-2">
                          <span className="text-purple-600 text-sm">
                            {a.type === "create_doc" ? "📝" : a.type === "update_doc" ? "🔄" : a.type === "comment" ? "💬" : "✓"}
                          </span>
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-ink-900 group-hover:text-purple-700">{a.label}</div>
                            {a.rationale && <div className="text-xs text-ink-500 mt-1">{a.rationale}</div>}
                          </div>
                          <span className="text-purple-400 text-xs opacity-0 group-hover:opacity-100">копія</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Мовна якість */}
            {analysis?.languageQuality && (
              <div className="border-t border-purple-200 px-5 py-4 bg-white/60">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-base">🇺🇦</span>
                  <span className="text-sm font-bold text-ink-900">Якість української</span>
                  <div className="flex-1" />
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-ink-200 rounded-full overflow-hidden">
                      <div
                        className={
                          "h-full " +
                          (analysis.languageQuality.score > 85
                            ? "bg-emerald-500"
                            : analysis.languageQuality.score > 65
                            ? "bg-amber-500"
                            : "bg-red-500")
                        }
                        style={{ width: `${analysis.languageQuality.score}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-ink-900 min-w-[40px] text-right">{analysis.languageQuality.score}%</span>
                  </div>
                  <span className="text-xs text-ink-600 italic">{analysis.languageQuality.verdict}</span>
                </div>
                {analysis.languageQuality.issues && analysis.languageQuality.issues.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {analysis.languageQuality.issues.map((iss, i) => {
                      const sevClass =
                        iss.severity === "high"
                          ? "bg-red-50 border-red-200"
                          : iss.severity === "medium"
                          ? "bg-amber-50 border-amber-200"
                          : "bg-blue-50 border-blue-200";
                      return (
                        <div key={i} className={"rounded-md p-2 border " + sevClass}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-ink-700">
                              {iss.type}
                            </span>
                            <span className="text-[10px] text-ink-500">{iss.severity}</span>
                          </div>
                          <div className="text-xs">
                            <span className="line-through text-red-600">{iss.found}</span>
                            <span className="text-ink-400 mx-1">→</span>
                            <span className="text-emerald-700 font-semibold">{iss.suggestion}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-emerald-700">✓ Мова чиста, проблем не знайдено</div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* FooterBar */}
      {result?.markdown && (
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

            </div>

            <div className="flex flex-col">
              <span className="text-[10px] text-ink-500 uppercase tracking-wider mb-0.5">Шаблон</span>
              <select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)}
                className="px-3 py-2 rounded-md border border-ink-200 text-sm bg-white focus:border-accent-400 focus:outline-none">
                {TEMPLATES.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
              </select>
            </div>

            <div className="flex-1" />

            <button onClick={() => { setInput(""); setResult(null); setAnalysis(null); setError(null); setTitle(""); }}
              className="px-4 py-2.5 rounded-lg border border-ink-200 hover:bg-ink-50 text-ink-700 text-sm font-medium">✕ Очистити</button>
            <button onClick={handleSaveDraft}
              className="px-4 py-2.5 rounded-lg border border-ink-200 hover:bg-ink-50 text-ink-700 text-sm font-medium">💾 Зберегти .md</button>
            <button onClick={handlePublish} disabled={loading}
              className="px-5 py-2.5 rounded-lg bg-accent-500 hover:bg-accent-600 disabled:bg-ink-300 text-white text-sm font-semibold flex items-center gap-2 shadow-card">
              📤 Опублікувати чернеткою в Outline
            </button>
          </div>
        </footer>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-ink-900 text-white px-5 py-2.5 rounded-lg shadow-soft text-sm font-medium z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
