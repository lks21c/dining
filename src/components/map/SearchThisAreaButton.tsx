"use client";

interface SearchThisAreaButtonProps {
  visible: boolean;
  onClick: () => void;
}

export default function SearchThisAreaButton({
  visible,
  onClick,
}: SearchThisAreaButtonProps) {
  if (!visible) return null;

  return (
    <button
      onClick={onClick}
      className="absolute top-20 left-1/2 -translate-x-1/2 z-20
        bg-white text-gray-800 px-4 py-2 rounded-full shadow-lg
        text-sm font-medium hover:bg-gray-50 active:bg-gray-100
        transition-all duration-200 border border-gray-200"
    >
      이 지역 재검색
    </button>
  );
}
