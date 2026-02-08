"use client";

import type { Place } from "@/types/place";

const TYPE_LABELS: Record<string, string> = {
  restaurant: "맛집",
  cafe: "카페",
  parking: "주차장",
};

interface PlaceDetailProps {
  place: Place;
  onClose: () => void;
}

export default function PlaceDetail({ place, onClose }: PlaceDetailProps) {
  const isRatable = place.type !== "parking";

  return (
    <div className="bg-white rounded-t-2xl shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">{place.name}</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {TYPE_LABELS[place.type]}
            </span>
          </div>
          {place.type === "restaurant" && (
            <p className="text-sm text-gray-500 mt-0.5">{place.category}</p>
          )}
          {place.type === "cafe" && (
            <p className="text-sm text-gray-500 mt-0.5">{place.specialty}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full
            hover:bg-gray-100 text-gray-400 transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Rating & Price */}
        {isRatable && "rating" in place && (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-yellow-600 font-medium">
              ★ {place.rating}
            </span>
            {"reviewCount" in place && (
              <span className="text-gray-400">
                리뷰 {place.reviewCount.toLocaleString()}개
              </span>
            )}
            {"priceRange" in place && (
              <span className="text-gray-600 font-medium">
                {place.priceRange}
              </span>
            )}
          </div>
        )}

        {/* Description */}
        <p className="text-sm text-gray-700 leading-relaxed">
          {place.description}
        </p>

        {/* Tags */}
        {isRatable && "atmosphere" in place && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded-full">
              {place.atmosphere}
            </span>
            {"goodFor" in place &&
              place.goodFor.split(",").map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-1 bg-gray-50 text-gray-600 rounded-full"
                >
                  {tag.trim()}
                </span>
              ))}
          </div>
        )}

        {/* Parking info for restaurants/cafes */}
        {isRatable && "parkingAvailable" in place && (
          <div className="text-xs text-gray-500">
            🚗 주차:{" "}
            {place.parkingAvailable
              ? "가능"
              : place.nearbyParking
              ? `근처 ${place.nearbyParking}`
              : "불가"}
          </div>
        )}

        {/* Parking lot details */}
        {place.type === "parking" && (
          <div className="space-y-2 bg-blue-50 rounded-lg p-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">유형</span>
              <span className="font-medium">{place.parkingType}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">주차 요금</span>
              <span className="font-medium">
                {place.hourlyRate.toLocaleString()}원/시간
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">수용 대수</span>
              <span className="font-medium">{place.capacity}대</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">운영 시간</span>
              <span className="font-medium">{place.operatingHours}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
