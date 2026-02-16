"use client";

import type { ReactNode } from "react";

export type PageMode = "prompt" | "search" | "places";

interface NavigationDrawerProps {
  open: boolean;
  currentMode: PageMode;
  onSelectMode: (mode: PageMode) => void;
  onClose: () => void;
}

const ChatIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const MapIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
    <line x1="8" y1="2" x2="8" y2="18" />
    <line x1="16" y1="6" x2="16" y2="22" />
  </svg>
);

const ListIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const MENU_ITEMS: { mode: PageMode; icon: ReactNode; label: string; hash: string }[] = [
  { mode: "prompt", icon: <ChatIcon />, label: "프롬프트 검색", hash: "#!/prompt" },
  { mode: "search", icon: <MapIcon />, label: "지도 기반 검색", hash: "#!/search" },
  { mode: "places", icon: <ListIcon />, label: "전체 장소", hash: "#!/places" },
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
              <a
                key={item.mode}
                href={item.hash}
                onClick={(e) => {
                  // Let Ctrl/Cmd+Click open in new tab naturally
                  if (e.metaKey || e.ctrlKey) return;
                  e.preventDefault();
                  onSelectMode(item.mode);
                  onClose();
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl
                  transition-colors text-sm font-medium no-underline
                  ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
              >
                <span className="w-5 h-5 flex items-center justify-center">{item.icon}</span>
                <span>{item.label}</span>
                {isActive && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-indigo-500" />
                )}
              </a>
            );
          })}
        </nav>
      </div>
    </>
  );
}
