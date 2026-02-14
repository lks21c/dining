"use client";

import type { Place } from "@/types/place";

const TYPE_LABELS: Record<string, string> = {
  restaurant: "맛집",
  cafe: "카페",
  bar: "술집",
  bakery: "빵집",
  parking: "주차장",
};

const TYPE_COLORS: Record<string, string> = {
  restaurant: "bg-red-100 text-red-700",
  cafe: "bg-amber-100 text-amber-800",
  bar: "bg-purple-100 text-purple-700",
  bakery: "bg-orange-100 text-orange-700",
  parking: "bg-blue-100 text-blue-700",
};

interface PlaceGridCardProps {
  place: Place;
  onClick: (place: Place) => void;
}

export default function PlaceGridCard({ place, onClick }: PlaceGridCardProps) {
  const rating =
    place.type !== "parking" && "rating" in place ? place.rating : null;
  const subtitle =
    place.type === "restaurant" || place.type === "bar"
      ? place.category
      : place.type === "cafe" || place.type === "bakery"
      ? place.specialty
      : null;

  return (
    <button
      onClick={() => onClick(place)}
      className="w-full text-left p-3 rounded-lg border border-gray-100
        hover:bg-gray-50 active:bg-gray-100 transition-colors"
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${TYPE_COLORS[place.type]}`}
        >
          {TYPE_LABELS[place.type]}
        </span>
        {place.type !== "parking" && place.diningcodeRank != null && (
          <span className="text-[10px] px-1 py-0.5 rounded bg-orange-600 text-white font-bold">
            {place.diningcodeRank}위
          </span>
        )}
      </div>
      <h3 className="font-semibold text-sm text-gray-900 line-clamp-1">
        {place.name}
      </h3>
      <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500">
        {subtitle && <span className="line-clamp-1">{subtitle}</span>}
        {rating != null && rating > 0 && (
          <span className="text-yellow-600 shrink-0">★ {rating}</span>
        )}
      </div>
    </button>
  );
}
