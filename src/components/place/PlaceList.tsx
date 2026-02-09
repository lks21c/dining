"use client";

import { Fragment } from "react";
import type { Place, PlaceType, SearchResult, Course } from "@/types/place";
import PlaceCard from "./PlaceCard";

const TABS: { label: string; value: PlaceType | "all" }[] = [
  { label: "전체", value: "all" },
  { label: "🍽️ 맛집", value: "restaurant" },
  { label: "☕ 카페", value: "cafe" },
  { label: "🅿️ 주차", value: "parking" },
];

const COURSE_COLORS = [
  { bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-700", badge: "bg-indigo-600" },
  { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", badge: "bg-emerald-600" },
  { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", badge: "bg-amber-600" },
  { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700", badge: "bg-rose-600" },
];

/** Render markdown-like summary: **bold** and newlines */
function SummaryText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, li) => (
        <Fragment key={li}>
          {li > 0 && <br />}
          {line.split(/(\*\*[^*]+\*\*)/).map((seg, si) => {
            if (seg.startsWith("**") && seg.endsWith("**")) {
              return (
                <strong key={si} className="text-gray-900 font-semibold">
                  {seg.slice(2, -2)}
                </strong>
              );
            }
            return <Fragment key={si}>{seg}</Fragment>;
          })}
        </Fragment>
      ))}
    </>
  );
}

interface PlaceListProps {
  places: Place[];
  activeType: PlaceType | "all";
  onTypeChange: (type: PlaceType | "all") => void;
  searchResult: SearchResult | null;
  onPlaceClick?: (place: Place) => void;
  loading?: boolean;
  activeCourse: number;
  onCourseSelect: (index: number) => void;
}

export default function PlaceList({
  places,
  activeType,
  onTypeChange,
  searchResult,
  onPlaceClick,
  loading,
  activeCourse,
  onCourseSelect,
}: PlaceListProps) {
  const hasCourses = searchResult && searchResult.courses && searchResult.courses.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Type tabs - only show when not in search mode */}
      {!hasCourses && (
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

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-3 p-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-1" />
                <div className="h-3 bg-gray-200 rounded w-full" />
              </div>
            ))}
          </div>
        ) : hasCourses ? (
          <div>
            {/* AI summary */}
            {searchResult.summary && (
              <div className="px-4 py-4 border-b border-gray-100">
                <div className="flex items-start gap-2.5">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center mt-0.5">
                    <span className="text-white text-xs font-bold">AI</span>
                  </div>
                  <div className="text-sm text-gray-700 leading-relaxed">
                    <SummaryText text={searchResult.summary} />
                  </div>
                </div>
              </div>
            )}

            {/* Course tabs */}
            <div className="flex gap-1.5 px-4 py-3 border-b border-gray-100 overflow-x-auto">
              {searchResult.courses.map((course, ci) => {
                const color = COURSE_COLORS[ci % COURSE_COLORS.length];
                const isActive = activeCourse === ci;
                return (
                  <button
                    key={course.courseNumber}
                    onClick={() => onCourseSelect(ci)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                      ${isActive
                        ? `${color.badge} text-white`
                        : `${color.bg} ${color.text} ${color.border} border`
                      }`}
                  >
                    코스 {course.courseNumber}
                  </button>
                );
              })}
            </div>

            {/* Active course detail */}
            {searchResult.courses.map((course, ci) => {
              if (ci !== activeCourse) return null;
              const color = COURSE_COLORS[ci % COURSE_COLORS.length];
              return (
                <div key={course.courseNumber}>
                  {/* Course header */}
                  <div className={`mx-3 mt-3 px-3 py-2.5 rounded-lg ${color.bg} ${color.border} border`}>
                    <p className={`text-sm font-semibold ${color.text}`}>
                      {course.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {course.routeSummary}
                    </p>
                  </div>

                  {/* Course stops as cards */}
                  <div className="px-2 py-2 space-y-1.5">
                    {course.stops.map((stop) => {
                      const place = searchResult.places.find((p) => p.id === stop.id);
                      if (!place) return null;
                      return (
                        <PlaceCard
                          key={`${course.courseNumber}-${stop.id}`}
                          place={place}
                          order={stop.order}
                          reason={stop.reason}
                          onClick={onPlaceClick}
                          expanded
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : places.length > 0 ? (
          <div className="px-2 py-2 space-y-1">
            {places.map((place) => (
              <PlaceCard key={place.id} place={place} onClick={onPlaceClick} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400 text-sm">
            이 지역에 등록된 장소가 없습니다
          </div>
        )}
      </div>
    </div>
  );
}
