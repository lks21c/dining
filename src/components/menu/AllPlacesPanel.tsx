"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useAllPlaces } from "@/hooks/useAllPlaces";
import PlaceGridCard from "./PlaceGridCard";
import type { Place, PlaceType } from "@/types/place";

const TYPE_FILTERS: { label: string; value: PlaceType | "all" }[] = [
  { label: "전체", value: "all" },
  { label: "맛집", value: "restaurant" },
  { label: "카페", value: "cafe" },
  { label: "술집", value: "bar" },
  { label: "빵집", value: "bakery" },
];

interface AllPlacesViewProps {
  onPlaceClick: (place: Place) => void;
}

export default function AllPlacesView({ onPlaceClick }: AllPlacesViewProps) {
  const {
    places,
    regions,
    loading,
    selectedRegion,
    selectedType,
    nameQuery,
    setSelectedRegion,
    setSelectedType,
    setNameQuery,
    totalCount,
    filteredCount,
  } = useAllPlaces(true);

  const [regionInput, setRegionInput] = useState("");
  const [regionOpen, setRegionOpen] = useState(false);
  const regionRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (regionRef.current && !regionRef.current.contains(e.target as Node)) {
        setRegionOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredRegions = useMemo(() => {
    const q = regionInput.trim();
    if (!q) return regions;
    return regions.filter((r) => r.includes(q));
  }, [regions, regionInput]);

  return (
    <div className="h-dvh w-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b border-gray-200"
        style={{ paddingTop: "calc(var(--sai-top) + 0.75rem)" }}
      >
        <div className="w-14" /> {/* spacer for hamburger button */}
        <h2 className="text-lg font-bold text-gray-900">전체 장소</h2>
      </div>

      {/* Filters */}
      <div className="px-4 py-3 space-y-3 border-b border-gray-100">
        {/* Name search */}
        <input
          type="text"
          value={nameQuery}
          onChange={(e) => setNameQuery(e.target.value)}
          placeholder="상호명 검색..."
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm
            outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400
            placeholder-gray-400"
        />

        {/* Region autocomplete */}
        <div ref={regionRef} className="relative">
          <div className="relative flex items-center">
            <svg
              className="absolute left-3 text-gray-400 pointer-events-none"
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <input
              type="text"
              value={regionOpen ? regionInput : selectedRegion || ""}
              onChange={(e) => {
                setRegionInput(e.target.value);
                setRegionOpen(true);
              }}
              onFocus={() => {
                setRegionInput("");
                setRegionOpen(true);
              }}
              placeholder="지역 검색..."
              className="w-full pl-8 pr-8 py-2 rounded-lg border border-gray-200 text-sm
                outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400
                placeholder-gray-400 text-gray-700 bg-white"
            />
            {selectedRegion && !regionOpen && (
              <button
                type="button"
                onClick={() => {
                  setSelectedRegion("");
                  setRegionInput("");
                }}
                className="absolute right-2.5 text-gray-400 hover:text-gray-600"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {regionOpen && (
            <ul className="absolute left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-52 overflow-y-auto">
              <li>
                <button
                  type="button"
                  className={`w-full text-left px-3 py-2.5 text-sm transition-colors
                    ${!selectedRegion ? "bg-indigo-50 text-indigo-700 font-medium" : "text-gray-800 hover:bg-indigo-50"}`}
                  onClick={() => {
                    setSelectedRegion("");
                    setRegionInput("");
                    setRegionOpen(false);
                  }}
                >
                  전체 지역
                </button>
              </li>
              {filteredRegions.map((r) => (
                <li key={r}>
                  <button
                    type="button"
                    className={`w-full text-left px-3 py-2.5 text-sm transition-colors
                      ${selectedRegion === r ? "bg-indigo-50 text-indigo-700 font-medium" : "text-gray-800 hover:bg-indigo-50"}`}
                    onClick={() => {
                      setSelectedRegion(r);
                      setRegionInput("");
                      setRegionOpen(false);
                    }}
                  >
                    {r}
                  </button>
                </li>
              ))}
              {filteredRegions.length === 0 && regionInput.trim() && (
                <li className="px-3 py-2.5 text-sm text-gray-400">일치하는 지역이 없습니다</li>
              )}
            </ul>
          )}
        </div>

        {/* Type tabs */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setSelectedType(f.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border
                transition-colors whitespace-nowrap
                ${
                  selectedType === f.value
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Result count */}
      <div className="px-4 py-2 text-xs text-gray-500">
        {loading ? (
          "로딩 중..."
        ) : (
          <>
            <span className="font-medium text-gray-900">{filteredCount}</span>
            개 장소
            {filteredCount !== totalCount && (
              <span className="ml-1 text-gray-400">
                (전체 {totalCount}개)
              </span>
            )}
          </>
        )}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-3 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="mb-3"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <p className="text-sm">조건에 맞는 장소가 없습니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {places.map((place) => (
              <PlaceGridCard
                key={place.id}
                place={place}
                onClick={onPlaceClick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
