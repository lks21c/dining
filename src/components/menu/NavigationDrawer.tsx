"use client";

export type PageMode = "search" | "places";

interface NavigationDrawerProps {
  open: boolean;
  currentMode: PageMode;
  onSelectMode: (mode: PageMode) => void;
  onClose: () => void;
}

const MENU_ITEMS: { mode: PageMode; icon: string; label: string }[] = [
  { mode: "search", icon: "🔍", label: "AI 추천 검색" },
  { mode: "places", icon: "📋", label: "전체 장소" },
];

export default function NavigationDrawer({
  open,
  currentMode,
  onSelectMode,
  onClose,
}: NavigationDrawerProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/40 transition-opacity duration-300
          ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl
          flex flex-col transition-transform duration-300 ease-out
          ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">메뉴</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-lg
              hover:bg-gray-100 transition-colors"
            aria-label="닫기"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {MENU_ITEMS.map((item) => {
            const isActive = currentMode === item.mode;
            return (
              <button
                key={item.mode}
                onClick={() => {
                  onSelectMode(item.mode);
                  onClose();
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left
                  transition-colors text-sm font-medium
                  ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
                {isActive && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-indigo-500" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}
