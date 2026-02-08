"use client";

import { useState, useCallback, useEffect } from "react";
import NaverMap from "@/components/map/NaverMap";
import PlaceMarker from "@/components/map/PlaceMarker";
import RouteMarkers from "@/components/map/RouteMarkers";
import SearchThisAreaButton from "@/components/map/SearchThisAreaButton";
import CrawlThisAreaButton from "@/components/map/CrawlThisAreaButton";
import PlaceList from "@/components/place/PlaceList";
import PlaceDetail from "@/components/place/PlaceDetail";
import SearchBar from "@/components/search/SearchBar";
import SearchSuggestions from "@/components/search/SearchSuggestions";
import BottomSheet from "@/components/ui/BottomSheet";
import { useNaverMap } from "@/hooks/useNaverMap";
import { useMapBounds } from "@/hooks/useMapBounds";
import { usePlaces } from "@/hooks/usePlaces";
import { useSearch } from "@/hooks/useSearch";
import { useCrawl } from "@/hooks/useCrawl";
import type { Place } from "@/types/place";

export default function Home() {
  const { map, isLoaded } = useNaverMap("naver-map");
  const { bounds, shouldSearch, searchThisArea } = useMapBounds(map);
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
  const { crawling, crawlResult, crawlError, crawlThisArea, setCrawlResult } =
    useCrawl();
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [crawlToast, setCrawlToast] = useState<string | null>(null);

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
  }, [clearSearch]);

  const handleCrawl = useCallback(() => {
    crawlThisArea(bounds);
  }, [crawlThisArea, bounds]);

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
      if (crawlResult.count > 0) {
        setCrawlToast(
          `${crawlResult.areaName}에서 ${crawlResult.count}개의 새로운 맛집 발견!`
        );
        searchThisArea();
      } else {
        setCrawlToast(`${crawlResult.areaName}: 새로운 맛집이 없습니다.`);
      }
      setCrawlResult(null);
      const timer = setTimeout(() => setCrawlToast(null), 3000);
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

        {/* Action buttons container */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
          <SearchThisAreaButton
            visible={shouldSearch && !searchResult}
            onClick={searchThisArea}
          />
          <CrawlThisAreaButton
            visible={isLoaded && !searchResult}
            crawling={crawling}
            onClick={handleCrawl}
          />
        </div>

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

        {/* Route markers (search mode) */}
        {map && searchResult && searchResult.recommendations.length > 0 && (
          <RouteMarkers map={map} searchResult={searchResult} />
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
      <BottomSheet>
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
          />
        )}
      </BottomSheet>
    </div>
  );
}
