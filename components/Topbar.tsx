export default function Topbar() {
  return (
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
  );
}
