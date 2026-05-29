"use client";

import type { AnalysisResult } from "../lib/types";

interface AnalysisPanelProps {
  analyzing: boolean;
  analysis: AnalysisResult | null;
  onActionClick: (label: string, rationale?: string) => void;
}

export default function AnalysisPanel({ analyzing, analysis, onActionClick }: AnalysisPanelProps) {
  if (!analyzing && !analysis) return null;

  return (
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
                <button key={i} onClick={() => onActionClick(a.label, a.rationale)}
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
  );
}
