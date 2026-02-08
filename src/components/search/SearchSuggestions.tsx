"use client";

const SUGGESTIONS = [
  "40대 부부 강남 데이트 코스",
  "4인 가족 홍대 맛집+카페",
  "혼밥하기 좋은 조용한 곳",
  "친구 4명 이태원 술집+주차",
  "가성비 좋은 점심 추천",
  "로맨틱 디너+디저트 코스",
];

interface SearchSuggestionsProps {
  visible: boolean;
  onSelect: (query: string) => void;
}

export default function SearchSuggestions({
  visible,
  onSelect,
}: SearchSuggestionsProps) {
  if (!visible) return null;

  return (
    <div className="absolute top-16 left-3 right-3 z-30">
      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => onSelect(suggestion)}
            className="px-3 py-1.5 bg-white/90 backdrop-blur text-xs
              text-gray-700 rounded-full shadow-sm border border-gray-200
              hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200
              transition-colors"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
