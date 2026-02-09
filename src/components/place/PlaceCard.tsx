"use client";

import type { Place } from "@/types/place";

const TYPE_LABELS: Record<string, string> = {
  restaurant: "맛집",
  cafe: "카페",
  parking: "주차장",
};

const TYPE_COLORS: Record<string, string> = {
  restaurant: "bg-red-100 text-red-700",
  cafe: "bg-amber-100 text-amber-800",
  parking: "bg-blue-100 text-blue-700",
};

interface PlaceCardProps {
  place: Place;
  order?: number;
  reason?: string;
  onClick?: (place: Place) => void;
  expanded?: boolean;
}

export default function PlaceCard({ place, order, reason, onClick, expanded }: PlaceCardProps) {
  const rating =
    place.type !== "parking" && "rating" in place ? place.rating : null;
  const priceRange =
    place.type !== "parking" && "priceRange" in place ? place.priceRange : null;
  const subtitle =
    place.type === "restaurant"
      ? place.category
      : place.type === "cafe"
      ? place.specialty
      : `${place.parkingType} · ${place.capacity}대`;

  return (
    <button
      onClick={() => onClick?.(place)}
      className="w-full text-left p-3 hover:bg-gray-50 active:bg-gray-100
        transition-colors rounded-lg border border-gray-100"
    >
      <div className="flex items-start gap-3">
        {order != null && (
          <div
            className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center
              text-white font-bold text-sm"
            style={{
              backgroundColor:
                place.type === "restaurant"
                  ? "#EF4444"
                  : place.type === "cafe"
                  ? "#92400E"
                  : "#3B82F6",
            }}
          >
            {order}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900 text-sm truncate">
              {place.name}
            </h3>
            <span
              className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ${TYPE_COLORS[place.type]}`}
            >
              {TYPE_LABELS[place.type]}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <span>{subtitle}</span>
            {rating != null && (
              <span className="text-yellow-600">★ {rating}</span>
            )}
            {priceRange && <span>{priceRange}</span>}
          </div>
          <p className={`text-xs text-gray-600 ${expanded ? "" : "line-clamp-2"}`}>
            {place.description}
          </p>
          {reason && (
            <p className="text-xs text-indigo-600 mt-1.5 font-medium leading-relaxed">
              💡 {reason}
            </p>
          )}
          {place.type === "parking" && (
            <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-500">
              {place.baseTime && place.baseRate ? (
                <span>{place.baseTime}분 {place.baseRate.toLocaleString()}원</span>
              ) : (
                <span>{place.hourlyRate.toLocaleString()}원/시</span>
              )}
              {place.extraTime && place.extraRate && (
                <>
                  <span>·</span>
                  <span>추가 {place.extraTime}분당 {place.extraRate.toLocaleString()}원</span>
                </>
              )}
              <span>·</span>
              <span>{place.operatingHours}</span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
