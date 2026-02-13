"use client";

import type { PlaceType } from "@/types/place";

const FILTERS: { label: string; value: PlaceType | "all" }[] = [
  { label: "전체", value: "all" },
  { label: "맛집", value: "restaurant" },
  { label: "카페", value: "cafe" },
  { label: "주차", value: "parking" },
];

interface FilterTagsProps {
  activeType: PlaceType | "all";
  onTypeChange: (type: PlaceType | "all") => void;
}

export default function FilterTags({ activeType, onTypeChange }: FilterTagsProps) {
  return (
    <div className="absolute top-16 left-3 z-30 flex gap-1.5">
      {FILTERS.map((f) => (
        <button
          key={f.value}
          onClick={() => onTypeChange(f.value)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium shadow-sm border
            transition-colors whitespace-nowrap
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
