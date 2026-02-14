"use client";

import type { PlaceType } from "@/types/place";

const FILTERS: { label: string; value: PlaceType | "all" }[] = [
  { label: "전체", value: "all" },
  { label: "맛집", value: "restaurant" },
  { label: "카페", value: "cafe" },
  { label: "술집", value: "bar" },
  { label: "빵집", value: "bakery" },
  { label: "주차", value: "parking" },
];

interface FilterTagsProps {
  activeType: PlaceType | "all";
  onTypeChange: (type: PlaceType | "all") => void;
}

export default function FilterTags({ activeType, onTypeChange }: FilterTagsProps) {
  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
      {FILTERS.map((f) => (
        <button
          key={f.value}
          onClick={() => onTypeChange(f.value)}
          className={`px-3 py-2 rounded-full text-xs font-medium shadow-sm border
            transition-colors whitespace-nowrap min-h-[44px]
            ${
              activeType === f.value
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
