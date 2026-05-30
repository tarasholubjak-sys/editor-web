"use client";

import { useState, useRef, useEffect } from "react";
import Topbar from "../components/Topbar";
import SourcePane from "../components/SourcePane";
import PreviewPane from "../components/PreviewPane";
import DuplicatesPanel from "../components/DuplicatesPanel";
import AnalysisPanel from "../components/AnalysisPanel";
import FooterBar from "../components/FooterBar";
import Toast from "../components/Toast";
import { AI_STEPS, TEMPLATES, AI_STEP_DURATION_MS, TOAST_DURATION_MS } from "../lib/constants";
import { extractTitle, safeCopy } from "../lib/utils";
import type {
  DupCandidate,
  RefactorResult,
  AnalysisResult,
  Collection,
  SourceTab,
} from "../lib/types";

export default function HomePage() {
  const [sourceTab, setSourceTab] = useState<SourceTab>("text");
  const [input, setInput] = useState<string>("");
  const [result, setResult] = useState<RefactorResult | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aiStep, setAiStep] = useState<string>(AI_STEPS[0]);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>(TEMPLATES[0].id);
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
    const id = setInterval(() => { i++; if (AI_STEPS[i]) setAiStep(AI_STEPS[i]); }, AI_STEP_DURATION_MS);
    return () => clearInterval(id);
  }, [loading]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), TOAST_DURATION_MS);
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

  const handleCopy = () => {
    if (result?.markdown) safeCopy(result.markdown, showToast, "Markdown у буфері");
  };

  // Ручне редагування згенерованого markdown перед публікацією
  const handleMarkdownChange = (md: string) => {
    setResult((prev) => (prev ? { ...prev, markdown: md } : prev));
    setTitle(extractTitle(md));
  };

  const handleActionClick = (label: string, rationale?: string) => {
    const prompt = rationale
      ? `${label}\n\nКонтекст: ${rationale}`
      : label;
    safeCopy(prompt, showToast, `Скопійовано: "${label.slice(0, 30)}..."`);
  };

  const handleClear = () => {
    setInput("");
    setResult(null);
    setAnalysis(null);
    setError(null);
    setTitle("");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Topbar />

      <main className="flex-1 max-w-[1400px] mx-auto w-full px-6 py-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-2.5 mb-4 text-sm flex items-center gap-2">
            <span>⚠️</span><span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800">✕</button>
          </div>
        )}

        {/* Дві колонки */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SourcePane
            sourceTab={sourceTab}
            setSourceTab={setSourceTab}
            input={input}
            setInput={setInput}
            loading={loading}
            result={result}
            fileInputRef={fileInputRef}
            onRefactor={handleRefactor}
            onFileUpload={handleFileUpload}
          />

          <PreviewPane
            result={result}
            loading={loading}
            aiStep={aiStep}
            title={title}
            setTitle={setTitle}
            onCopy={handleCopy}
            onMarkdownChange={handleMarkdownChange}
          />
        </div>

        {result?.duplicates && result.duplicates.length > 0 && (
          <DuplicatesPanel
            duplicates={result.duplicates}
            recommendation={result.recommendation}
          />
        )}

        <AnalysisPanel
          analyzing={analyzing}
          analysis={analysis}
          onActionClick={handleActionClick}
        />
      </main>

      {result?.markdown && (
        <FooterBar
          collections={collections}
          selectedCollectionId={selectedCollectionId}
          setSelectedCollectionId={setSelectedCollectionId}
          selectedTemplate={selectedTemplate}
          setSelectedTemplate={setSelectedTemplate}
          loading={loading}
          onClear={handleClear}
          onSaveDraft={handleSaveDraft}
          onPublish={handlePublish}
        />
      )}

      <Toast message={toast} />
    </div>
  );
}
