"use client";

import { useState, useRef, useEffect } from "react";
import type { CrawlProgress } from "@/hooks/useCrawl";

interface CrawlButtonProps {
  crawling: boolean;
  onCrawl: (keyword: string) => void;
  crawlProgress: CrawlProgress | null;
}

export default function CrawlButton({ crawling, onCrawl, crawlProgress }: CrawlButtonProps) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const handleSubmit = () => {
    const trimmed = keyword.trim();
    if (!trimmed || crawling) return;
    onCrawl(trimmed);
    setKeyword("");
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        disabled={crawling}
        className="bg-orange-500 text-white px-4 py-2 rounded-full shadow-lg
          text-sm font-medium hover:bg-orange-600 active:bg-orange-700
          transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed
          flex items-center gap-2 min-h-[44px]"
      >
        {crawling && (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        )}
        {crawling ? "크롤링 중..." : "추가 크롤링"}
      </button>

      {/* Progress bar panel */}
      {crawling && crawlProgress && (
        <div className="fixed inset-x-4 bottom-[calc(42dvh+1rem)] z-50
          bg-white rounded-xl shadow-xl border border-gray-200 px-4 py-3
          md:absolute md:inset-x-auto md:bottom-auto md:top-full md:mt-2 md:left-1/2 md:-translate-x-1/2 md:w-60">
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${crawlProgress.percent}%` }}
            />
          </div>
          <p className="text-xs text-gray-600 mt-1.5 text-center truncate">
            {crawlProgress.message}
          </p>
        </div>
      )}

      {open && !crawling && (
        <div className="fixed inset-x-4 bottom-[calc(42dvh+1rem)] z-50
          bg-white rounded-xl shadow-xl border border-gray-200 p-3
          md:absolute md:inset-x-auto md:bottom-auto md:top-full md:mt-2 md:left-1/2 md:-translate-x-1/2 md:w-72">
          <p className="text-xs text-gray-500 mb-2">
            검색 키워드를 입력하세요 (예: 여의도 맛집, 강남 카페)
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            className="flex gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="상도동 맛집"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={!keyword.trim()}
              className="px-3 py-2 bg-orange-500 text-white text-sm rounded-lg
                hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed
                transition-colors whitespace-nowrap min-h-[44px]"
            >
              검색
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
