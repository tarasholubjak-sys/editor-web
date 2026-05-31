export default function Topbar() {
  return (
    <header className="bg-white border-b border-ink-200 sticky top-0 z-30">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-gradient-to-br from-accent-500 to-accent-700 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-card">S</div>
          <div className="leading-tight">
            <div className="text-[15px] font-bold text-ink-900">
              Selfy <span className="text-ink-500 font-medium">Knowledge Editor</span>
            </div>
            <div className="text-[11px] text-ink-500">AI-редактор бази знань</div>
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-ink-500 ml-4">
          <span>›</span><span>Чернетки</span><span>›</span>
          <span className="font-semibold text-ink-800">Нова стаття</span>
        </div>
        <div className="flex-1" />

        {/* Статус-пігулка */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="hidden sm:inline">Синхронізовано</span>
          <span className="sm:hidden">Sync</span>
        </div>

        {/* Кнопка-пігулка: Аналіз бази */}
        <a href="/tree"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold border border-purple-200 transition whitespace-nowrap">
          <span>🌳</span><span className="hidden sm:inline">Аналіз бази</span>
        </a>

        {/* Кнопка-пігулка: Outline */}
        <a href="https://wiki.selfy.com.ua" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-50 hover:bg-accent-100 text-accent-700 text-xs font-semibold border border-accent-200 transition whitespace-nowrap">
          <span>↗</span><span className="hidden sm:inline">Outline</span>
        </a>
      </div>
    </header>
  );
}
