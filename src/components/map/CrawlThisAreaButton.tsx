"use client";

interface CrawlThisAreaButtonProps {
  visible: boolean;
  crawling: boolean;
  onClick: () => void;
}

export default function CrawlThisAreaButton({
  visible,
  crawling,
  onClick,
}: CrawlThisAreaButtonProps) {
  if (!visible) return null;

  return (
    <button
      onClick={onClick}
      disabled={crawling}
      className="bg-orange-500 text-white px-4 py-2 rounded-full shadow-lg
        text-sm font-medium hover:bg-orange-600 active:bg-orange-700
        transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed
        flex items-center gap-2"
    >
      {crawling && (
        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
      )}
      {crawling ? "크롤링 중..." : "이 지역 추가크롤링"}
    </button>
  );
}
