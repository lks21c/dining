"use client";

import { useState, useEffect } from "react";
import type { Place, ParkingLot } from "@/types/place";

interface MenuData {
  menuName: string;
  price: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  restaurant: "맛집",
  cafe: "카페",
  parking: "주차장",
};

function calc3HourRate(p: ParkingLot): number {
  const minutes = 180;
  if (p.baseTime && p.baseRate != null && p.extraTime && p.extraRate != null) {
    if (minutes <= p.baseTime) return p.baseRate;
    const extraMinutes = minutes - p.baseTime;
    const extraUnits = Math.ceil(extraMinutes / p.extraTime);
    return p.baseRate + extraUnits * p.extraRate;
  }
  return p.hourlyRate * 3;
}

interface PlaceDetailProps {
  place: Place;
  onClose: () => void;
}

export default function PlaceDetail({ place, onClose }: PlaceDetailProps) {
  const isRatable = place.type !== "parking";
  const [menus, setMenus] = useState<MenuData[]>([]);

  useEffect(() => {
    if (place.type === "parking") return;
    fetch(`/api/menus?placeName=${encodeURIComponent(place.name)}`)
      .then((r) => r.json())
      .then((data: MenuData[]) => setMenus(data))
      .catch(() => setMenus([]));
  }, [place.name, place.type]);

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

        {/* Menu items */}
        {menus.length > 0 && (
          <div className="bg-yellow-50 rounded-lg p-3 space-y-1.5">
            <p className="text-xs font-semibold text-yellow-800 mb-1">
              대표메뉴
            </p>
            {menus.map((m) => (
              <div key={m.menuName} className="flex justify-between text-sm">
                <span className="text-gray-800">{m.menuName}</span>
                {m.price && (
                  <span className="text-yellow-700 font-medium">{m.price}</span>
                )}
              </div>
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

        {/* External search links */}
        {place.type !== "parking" && (
          <div className="grid grid-cols-2 gap-2">
            <a
              href={`https://map.naver.com/p/search/${encodeURIComponent(place.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 py-2 rounded-lg
                bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                <path d="M12 2C7.03 2 3 6.03 3 11c0 3.19 1.66 5.99 4.16 7.59L12 22l4.84-3.41C19.34 16.99 21 14.19 21 11c0-4.97-4.03-9-9-9zm0 12.5c-1.93 0-3.5-1.57-3.5-3.5S10.07 7.5 12 7.5s3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" />
              </svg>
              네이버지도
            </a>
            <a
              href={`https://search.naver.com/search.naver?ssc=tab.blog&query=${encodeURIComponent(place.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 py-2 rounded-lg
                bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                <path d="M16.273 12.845 7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727v12.845z" />
              </svg>
              네이버블로그
            </a>
            <a
              href={`https://www.diningcode.com/list.dc?query=${encodeURIComponent(place.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 py-2 rounded-lg
                bg-orange-50 text-orange-700 text-xs font-medium hover:bg-orange-100 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                <path d="M3 3h18v2H3V3zm0 4h12v2H3V7zm0 4h18v2H3v-2zm0 4h12v2H3v-2zm0 4h18v2H3v-2z" />
              </svg>
              다이닝코드
            </a>
            <a
              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(place.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 py-2 rounded-lg
                bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
              YouTube
            </a>
          </div>
        )}

        {/* Parking lot details */}
        {place.type === "parking" && (
          <div className="space-y-2 bg-blue-50 rounded-lg p-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">유형</span>
              <span className="font-medium">{place.parkingType}</span>
            </div>
            {place.address && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">주소</span>
                <span className="font-medium text-right">{place.address}</span>
              </div>
            )}
            {place.baseTime && place.baseRate ? (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">기본 요금</span>
                  <span className="font-medium">
                    {place.baseTime}분 {place.baseRate.toLocaleString()}원
                  </span>
                </div>
                {place.extraTime && place.extraRate && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">추가 요금</span>
                    <span className="font-medium">
                      {place.extraTime}분당 {place.extraRate.toLocaleString()}원
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">주차 요금</span>
                <span className="font-medium">
                  {place.hourlyRate.toLocaleString()}원/시간
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">수용 대수</span>
              <span className="font-medium">{place.capacity}대</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">운영 시간</span>
              <span className="font-medium">{place.operatingHours}</span>
            </div>
            {/* 3시간 주차 요금 계산 */}
            {(() => {
              const total = calc3HourRate(place);
              const isPublic = place.parkingType === "공영";
              const evRate = isPublic ? Math.round(total * 0.5) : null;
              return (
                <div className="border-t border-blue-200 pt-2 mt-2 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">3시간 주차 시</span>
                    <span className="font-medium">
                      {total.toLocaleString()}원
                    </span>
                  </div>
                  {evRate != null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-green-700 flex items-center gap-1">
                        <span>⚡</span> 전기차
                      </span>
                      <span className="font-bold text-green-700">
                        {evRate.toLocaleString()}원
                        <span className="text-xs font-normal text-green-600 ml-1">
                          (50% 할인)
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}
            {place.freeNote && (
              <div className="text-xs text-blue-700 bg-blue-100 rounded px-2 py-1.5 mt-1">
                💡 {place.freeNote}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
