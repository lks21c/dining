"use client";

import { useCallback, type FormEvent } from "react";

interface SearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  onClear: () => void;
  searching: boolean;
  hasResult: boolean;
}

export default function SearchBar({
  query,
  onQueryChange,
  onSearch,
  onClear,
  searching,
  hasResult,
}: SearchBarProps) {
  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      onSearch();
    },
    [onSearch]
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="absolute top-3 left-3 right-3 z-30"
    >
      <div className="relative flex items-center bg-white rounded-xl shadow-lg border border-gray-200">
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="예: 40대 부부 강남 이탈리안 데이트"
          className="flex-1 px-4 py-3 rounded-xl text-sm bg-transparent
            outline-none placeholder-gray-400 text-gray-900"
        />
        {searching && (
          <div className="flex items-center gap-1 pr-2 text-xs text-indigo-600">
            <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            <span>AI 추천 중...</span>
          </div>
        )}
        {hasResult && !searching && (
          <button
            type="button"
            onClick={onClear}
            className="px-3 py-1 mr-1 text-xs text-gray-500 hover:text-gray-700
              hover:bg-gray-100 rounded-lg transition-colors"
          >
            초기화
          </button>
        )}
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="px-4 py-3 text-indigo-600 font-medium text-sm
            disabled:text-gray-300 hover:text-indigo-800 transition-colors"
        >
          검색
        </button>
      </div>
    </form>
  );
}
