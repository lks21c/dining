"use client";

import type { Place, PlaceType, SearchResult } from "@/types/place";
import PlaceCard from "./PlaceCard";

const TABS: { label: string; value: PlaceType | "all" }[] = [
  { label: "전체", value: "all" },
  { label: "🍽️ 맛집", value: "restaurant" },
  { label: "☕ 카페", value: "cafe" },
  { label: "🅿️ 주차", value: "parking" },
];

interface PlaceListProps {
  places: Place[];
  activeType: PlaceType | "all";
  onTypeChange: (type: PlaceType | "all") => void;
  searchResult: SearchResult | null;
  onPlaceClick?: (place: Place) => void;
  loading?: boolean;
}

export default function PlaceList({
  places,
  activeType,
  onTypeChange,
  searchResult,
  onPlaceClick,
  loading,
}: PlaceListProps) {
  const isSearchMode = searchResult && searchResult.recommendations.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Search result header */}
      {isSearchMode && (
        <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100">
          <p className="text-sm font-medium text-indigo-900">
            🎯 {searchResult.persona}
          </p>
          <p className="text-xs text-indigo-600 mt-1">
            {searchResult.routeSummary}
          </p>
        </div>
      )}

      {/* Type tabs - only show when not in search mode */}
      {!isSearchMode && (
        <div className="flex gap-1 px-4 py-2 border-b border-gray-100 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => onTypeChange(tab.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors
                ${
                  activeType === tab.value
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Place list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {loading ? (
          <div className="space-y-3 p-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-1" />
                <div className="h-3 bg-gray-200 rounded w-full" />
              </div>
            ))}
          </div>
        ) : isSearchMode ? (
          searchResult.recommendations.map((rec) => {
            const place = searchResult.places.find((p) => p.id === rec.id);
            if (!place) return null;
            return (
              <PlaceCard
                key={rec.id}
                place={place}
                order={rec.order}
                reason={rec.reason}
                onClick={onPlaceClick}
              />
            );
          })
        ) : places.length > 0 ? (
          places.map((place) => (
            <PlaceCard key={place.id} place={place} onClick={onPlaceClick} />
          ))
        ) : (
          <div className="text-center py-8 text-gray-400 text-sm">
            이 지역에 등록된 장소가 없습니다
          </div>
        )}
      </div>
    </div>
  );
}
