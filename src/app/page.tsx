"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import NaverMap from "@/components/map/NaverMap";
import PlaceMarker from "@/components/map/PlaceMarker";
import RouteMarkers from "@/components/map/RouteMarkers";
import CrawlButton from "@/components/map/CrawlThisAreaButton";
import PlaceList from "@/components/place/PlaceList";
import PlaceDetail from "@/components/place/PlaceDetail";
import SearchBar from "@/components/search/SearchBar";
import SearchSuggestions from "@/components/search/SearchSuggestions";
import BottomSheet from "@/components/ui/BottomSheet";
import { useNaverMap } from "@/hooks/useNaverMap";
import { useMapBounds, MIN_MARKER_ZOOM } from "@/hooks/useMapBounds";
import { usePlaces } from "@/hooks/usePlaces";
import { useSearch } from "@/hooks/useSearch";
import { useCrawl } from "@/hooks/useCrawl";
import type { Place, SearchResult } from "@/types/place";

export default function Home() {
  const { map, isLoaded } = useNaverMap("naver-map");
  const { bounds, zoom, searchThisArea } = useMapBounds(map);
  const { places, allPlaces, loading, activeType, setActiveType } = usePlaces(bounds);
  const {
    query,
    setQuery,
    result: searchResult,
    searching,
    error,
    search,
    clearSearch,
  } = useSearch();
  const { crawling, crawlResult, crawlError, crawl, setCrawlResult } =
    useCrawl();
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [crawlToast, setCrawlToast] = useState<string | null>(null);
  const [activeCourse, setActiveCourse] = useState(0);

  // Reset active course when search result changes
  useEffect(() => {
    setActiveCourse(0);
  }, [searchResult]);

  // Derive display result for RouteMarkers based on selected course
  const displayResult: SearchResult | null = useMemo(() => {
    if (!searchResult?.courses?.length) return searchResult;
    const course = searchResult.courses[activeCourse];
    if (!course) return searchResult;

    const placeMap = new Map(searchResult.places.map((p) => [p.id, p]));
    const coursePlaces = course.stops
      .map((s) => placeMap.get(s.id))
      .filter((p): p is Place => !!p);

    return {
      ...searchResult,
      recommendations: course.stops,
      routeSummary: course.routeSummary,
      places: coursePlaces,
    };
  }, [searchResult, activeCourse]);

  const handleSearch = useCallback(() => {
    search(query, bounds);
  }, [search, query, bounds]);

  const handleSuggestionSelect = useCallback(
    (suggestion: string) => {
      setQuery(suggestion);
      search(suggestion, bounds);
    },
    [setQuery, search, bounds]
  );

  const handlePlaceClick = useCallback(
    (place: Place) => {
      setSelectedPlace(place);
      if (map) {
        map.panTo(new naver.maps.LatLng(place.lat, place.lng));
      }
    },
    [map]
  );

  const handleClearSearch = useCallback(() => {
    clearSearch();
    setSelectedPlace(null);
    setActiveCourse(0);
  }, [clearSearch]);

  const handleCrawl = useCallback(
    (keyword: string) => {
      crawl(keyword, bounds);
    },
    [crawl, bounds]
  );

  // Move map to center when search returns a geocoded location
  useEffect(() => {
    if (map && searchResult?.center) {
      const { lat, lng } = searchResult.center;
      map.setCenter(new naver.maps.LatLng(lat, lng));
      map.setZoom(15);
    }
  }, [map, searchResult]);

  // Show toast and refetch when crawl completes
  useEffect(() => {
    if (crawlResult) {
      const parts: string[] = [];
      if (crawlResult.count > 0) {
        parts.push(`맛집 ${crawlResult.count}개`);
      }
      if (crawlResult.parkingAdded > 0) {
        parts.push(`주차장 ${crawlResult.parkingAdded}개`);
      }

      if (parts.length > 0) {
        setCrawlToast(`"${crawlResult.keyword}" → ${parts.join(", ")} 추가!`);
        searchThisArea();
      } else {
        setCrawlToast(`"${crawlResult.keyword}": 새로운 결과가 없습니다.`);
      }
      setCrawlResult(null);
      const timer = setTimeout(() => setCrawlToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [crawlResult, searchThisArea, setCrawlResult]);

  const showSuggestions = !query && !searchResult && isLoaded;

  return (
    <div className="h-dvh w-full flex flex-col md:flex-row relative overflow-hidden">
      {/* Map area */}
      <div className="flex-1 relative">
        <NaverMap />

        <SearchBar
          query={query}
          onQueryChange={setQuery}
          onSearch={handleSearch}
          onClear={handleClearSearch}
          searching={searching}
          hasResult={!!searchResult}
        />

        <SearchSuggestions
          visible={showSuggestions}
          onSelect={handleSuggestionSelect}
        />

        {/* Action buttons container — only when zoomed in */}
        {isLoaded && !searchResult && zoom >= MIN_MARKER_ZOOM && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20">
            <CrawlButton crawling={crawling} onCrawl={handleCrawl} />
          </div>
        )}

        {/* Zoom hint — when zoomed out */}
        {isLoaded && !searchResult && zoom < MIN_MARKER_ZOOM && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20">
            <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-md text-sm text-gray-500 whitespace-nowrap">
              지도를 확대하면 맛집이 표시됩니다
            </div>
          </div>
        )}

        {/* Error toast */}
        {(error || crawlError) && (
          <div className="absolute bottom-4 left-4 right-4 z-30 md:left-auto md:right-4 md:w-80">
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg shadow-lg">
              {error || crawlError}
            </div>
          </div>
        )}

        {/* Crawl success toast */}
        {crawlToast && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
            <div className="bg-orange-50 border border-orange-200 text-orange-800 text-sm px-4 py-3 rounded-lg shadow-lg whitespace-nowrap">
              {crawlToast}
            </div>
          </div>
        )}

        {/* Regular markers (non-search mode) */}
        {map && !searchResult && (
          <>
            {allPlaces.map((place) => (
              <PlaceMarker
                key={place.id}
                map={map}
                place={place}
                onClick={handlePlaceClick}
              />
            ))}
          </>
        )}

        {/* Route markers (search mode — shows selected course) */}
        {map && displayResult && displayResult.recommendations.length > 0 && (
          <RouteMarkers map={map} searchResult={displayResult} />
        )}

        {/* Loading overlay */}
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
            <div className="text-center">
              <div className="w-8 h-8 border-3 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-500">지도 로딩 중...</p>
            </div>
          </div>
        )}
      </div>

      {/* Side panel / Bottom sheet */}
      <BottomSheet expandOnContent={!!searchResult}>
        {selectedPlace ? (
          <PlaceDetail
            place={selectedPlace}
            onClose={() => setSelectedPlace(null)}
          />
        ) : (
          <PlaceList
            places={places}
            activeType={activeType}
            onTypeChange={setActiveType}
            searchResult={searchResult}
            onPlaceClick={handlePlaceClick}
            loading={loading || searching}
            activeCourse={activeCourse}
            onCourseSelect={setActiveCourse}
          />
        )}
      </BottomSheet>
    </div>
  );
}
