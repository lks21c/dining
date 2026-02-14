"use client";

interface HamburgerButtonProps {
  onClick: () => void;
}

export default function HamburgerButton({ onClick }: HamburgerButtonProps) {
  return (
    <button
      onClick={onClick}
      className="fixed left-3 z-40 w-11 h-11 bg-white rounded-xl shadow-lg border border-gray-200
        flex items-center justify-center hover:bg-gray-50 active:bg-gray-100 transition-colors"
      style={{ top: "calc(var(--sai-top) + 0.75rem)" }}
      aria-label="전체 장소 메뉴"
    >
      <svg
        width="18"
        height="14"
        viewBox="0 0 18 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="text-gray-700"
      >
        <line x1="1" y1="1" x2="17" y2="1" />
        <line x1="1" y1="7" x2="17" y2="7" />
        <line x1="1" y1="13" x2="17" y2="13" />
      </svg>
    </button>
  );
}
