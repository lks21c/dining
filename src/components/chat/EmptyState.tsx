"use client";

interface EmptyStateProps {
  onSelectQuery: (query: string) => void;
}

const SUGGESTED_QUERIES = [
  "이태원 데이트 이탈리안",
  "강남역 혼밥",
  "홍대 카페 투어",
  "성수동 브런치",
];

export default function EmptyState({ onSelectQuery }: EmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="w-14 h-14 rounded-full bg-[#FEE500]/30 flex items-center justify-center mb-4">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#3C1E1E]">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-[#3C1E1E] mb-1">맛집 추천 채팅</h2>
      <p className="text-sm text-gray-500 mb-6">
        지역과 원하는 음식을 알려주시면<br />AI가 코스를 추천해 드립니다
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTED_QUERIES.map((q) => (
          <button
            key={q}
            onClick={() => onSelectQuery(q)}
            className="px-3.5 py-2 rounded-full border border-gray-200 bg-white text-sm text-gray-700
              hover:bg-[#FEE500]/20 hover:border-[#FEE500] hover:text-[#3C1E1E]
              active:bg-[#FEE500]/40 transition-colors"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
