import type { DupCandidate } from "../lib/types";

interface DuplicatesPanelProps {
  duplicates: DupCandidate[];
  recommendation?: string;
}

export default function DuplicatesPanel({ duplicates, recommendation }: DuplicatesPanelProps) {
  if (!duplicates || duplicates.length === 0) return null;

  return (
    <div className="mt-4 bg-white border border-ink-200 rounded-xl shadow-card overflow-hidden">
      <div className="px-4 py-3 border-b border-ink-200 flex items-center gap-2 flex-wrap">
        <span className="text-base">🔍</span>
        <span className="text-sm font-semibold text-ink-800">Перевірка дублікатів</span>
        <span className="text-xs text-ink-500 ml-2">{duplicates.length} схожих в Outline + Google Drive</span>
        {recommendation && (
          <span className="ml-auto text-xs text-amber-700 font-medium">💡 {recommendation}</span>
        )}
      </div>
      <div className="p-4 space-y-3">
        {duplicates.map((d) => {
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
  );
}
