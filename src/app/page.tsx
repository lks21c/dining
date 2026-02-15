"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import NaverMap from "@/components/map/NaverMap";
import PlaceMarker from "@/components/map/PlaceMarker";
import RouteMarkers from "@/components/map/RouteMarkers";
import CrawlButton from "@/components/map/CrawlThisAreaButton";
import PlaceList from "@/components/place/PlaceList";
import PlaceDetail from "@/components/place/PlaceDetail";
import SearchBar from "@/components/search/SearchBar";
import FilterTags from "@/components/search/FilterTags";
import RegionSearch from "@/components/search/RegionSearch";
import HamburgerButton from "@/components/menu/HamburgerButton";
import NavigationDrawer from "@/components/menu/NavigationDrawer";
import AllPlacesView from "@/components/menu/AllPlacesPanel";
import type { PageMode } from "@/components/menu/NavigationDrawer";
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
  const { crawling, crawlResult, crawlError, crawlProgress, crawl, setCrawlResult } =
    useCrawl();
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [crawlToast, setCrawlToast] = useState<string | null>(null);
  const [activeCourse, setActiveCourse] = useState(0);
  const [regionName, setRegionName] = useState<string | undefined>();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Hash-bang routing: #!/search ↔ #!/places
  const [pageMode, setPageMode] = useState<PageMode>(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      if (hash === "#!/places") return "places";
    }
    return "search";
  });

  // Set initial hash if absent, and sync hash → state on browser back/forward
  useEffect(() => {
    if (!window.location.hash) {
      window.history.replaceState(null, "", "#!/search");
    }
    function onHashChange() {
      const hash = window.location.hash;
      if (hash === "#!/places") setPageMode("places");
      else setPageMode("search");
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Wrapper that also pushes the hash
  const handleSetPageMode = useCallback((mode: PageMode) => {
    setPageMode(mode);
    const hash = mode === "places" ? "#!/places" : "#!/search";
    if (window.location.hash !== hash) {
      window.history.pushState(null, "", hash);
    }
  }, []);

  // Compute displayRank for the selected place based on filtered list position
  const selectedDisplayRank = useMemo(() => {
    if (!selectedPlace || !("diningcodeRank" in selectedPlace) || selectedPlace.diningcodeRank == null) {
      return undefined;
    }
    const idx = places.findIndex((p) => p.id === selectedPlace.id);
    return idx >= 0 ? idx + 1 : undefined;
  }, [selectedPlace, places]);

  // Reset active course when search result changes, persist region name
  useEffect(() => {
    setActiveCourse(0);
    if (searchResult?.center?.name) {
      setRegionName(searchResult.center.name);
    }
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

  const handlePlaceClick = useCallback(
    (place: Place) => {
      setSelectedPlace(place);
      if (map) {
        map.panTo(new naver.maps.LatLng(place.lat, place.lng));
      }
    },
    [map]
  );

  const handleGridPlaceClick = useCallback(
    (place: Place) => {
      handleSetPageMode("search");
      setSelectedPlace(place);
      if (map) {
        map.panTo(new naver.maps.LatLng(place.lat, place.lng));
        map.setZoom(16);
      }
    },
    [map, handleSetPageMode]
  );

  const handleClearSearch = useCallback(() => {
    clearSearch();
    setSelectedPlace(null);
    setActiveCourse(0);
  }, [clearSearch]);

  const handleRegionSelect = useCallback(
    (region: { name: string; lat: number; lng: number }) => {
      if (map) {
        map.panTo(new naver.maps.LatLng(region.lat, region.lng));
        map.setZoom(15);
      }
      setRegionName(region.name);
    },
    [map]
  );

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
      setRegionName(crawlResult.keyword);
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
    }
  }, [crawlResult, searchThisArea, setCrawlResult]);

  // Auto-dismiss toast after 4s (separate from crawlResult to avoid cleanup conflict)
  useEffect(() => {
    if (crawlToast) {
      const timer = setTimeout(() => setCrawlToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [crawlToast]);


  return (
    <div className="h-dvh w-full flex flex-col md:flex-row relative overflow-hidden">
      {/* Hamburger button — always visible on both modes */}
      <HamburgerButton onClick={() => setDrawerOpen(true)} />

      {/* Navigation Drawer */}
      <NavigationDrawer
        open={drawerOpen}
        currentMode={pageMode}
        onSelectMode={handleSetPageMode}
        onClose={() => setDrawerOpen(false)}
      />

      {pageMode === "places" ? (
        <AllPlacesView onPlaceClick={handleGridPlaceClick} />
      ) : (
      <>
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

        {/* Filter tags + Region search — only when not in search mode */}
        {isLoaded && !searchResult && (
          <div
            className="absolute left-0 right-0 px-3 z-30 flex items-center gap-2"
            style={{ top: "calc(var(--sai-top) + 4rem)" }}
          >
            <RegionSearch onSelect={handleRegionSelect} />
            <FilterTags activeType={activeType} onTypeChange={setActiveType} />
          </div>
        )}

        {/* Action buttons container — only when zoomed in */}
        {isLoaded && !searchResult && zoom >= MIN_MARKER_ZOOM && (
          <div
            className="absolute left-1/2 -translate-x-1/2 z-30"
            style={{ top: "calc(var(--sai-top) + 6.5rem)" }}
          >
            <CrawlButton crawling={crawling} onCrawl={handleCrawl} crawlProgress={crawlProgress} />
          </div>
        )}

        {/* Zoom hint — when zoomed out */}
        {isLoaded && !searchResult && zoom < MIN_MARKER_ZOOM && (
          <div
            className="absolute left-1/2 -translate-x-1/2 z-20"
            style={{ top: "calc(var(--sai-top) + 6.5rem)" }}
          >
            <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-md text-sm text-gray-500 whitespace-nowrap">
              지도를 확대하면 맛집이 표시됩니다
            </div>
          </div>
        )}

        {/* LLM warning toast */}
        {searchResult?.warning && (
          <div className="fixed bottom-[calc(42dvh+0.75rem)] left-4 right-4 z-45 md:absolute md:bottom-4 md:left-auto md:right-4 md:w-96">
            <div className="bg-amber-50 border border-amber-300 text-amber-800 text-sm px-4 py-3 rounded-lg shadow-lg flex items-start gap-2">
              <span className="shrink-0 mt-0.5">⚠️</span>
              <span>{searchResult.warning}</span>
            </div>
          </div>
        )}

        {/* Error toast */}
        {(error || crawlError) && (
          <div className="fixed bottom-[calc(42dvh+0.75rem)] left-4 right-4 z-45 md:absolute md:bottom-4 md:left-auto md:right-4 md:w-80">
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg shadow-lg">
              {error || crawlError}
            </div>
          </div>
        )}

        {/* Crawl success toast */}
        {crawlToast && (
          <div className="fixed bottom-[calc(42dvh+0.75rem)] left-4 right-4 z-45 md:absolute md:bottom-4 md:left-1/2 md:-translate-x-1/2 md:left-auto md:right-auto md:w-auto">
            <div className="bg-orange-50 border border-orange-200 text-orange-800 text-sm px-4 py-3 rounded-lg shadow-lg text-center">
              {crawlToast}
            </div>
          </div>
        )}

        {/* Regular markers (non-search mode, respects filter) */}
        {map && !searchResult && (
          <>
            {places.map((place, index) => (
              <PlaceMarker
                key={place.id}
                map={map}
                place={place}
                onClick={handlePlaceClick}
                displayRank={"diningcodeRank" in place && place.diningcodeRank != null ? index + 1 : undefined}
              />
            ))}
          </>
        )}

        {/* Route markers (search mode — shows selected course) */}
        {map && displayResult && displayResult.recommendations.length > 0 && (
          <RouteMarkers map={map} searchResult={displayResult} />
        )}

        {/* Current location button */}
        {map && isLoaded && (
          <button
            className="fixed right-4 z-20 w-11 h-11 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 active:bg-gray-100 transition-colors bottom-[calc(42dvh+3.5rem)] md:absolute md:bottom-24"
            onClick={() => {
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  const { latitude, longitude } = pos.coords;
                  map.setCenter(new naver.maps.LatLng(latitude, longitude));
                  map.setZoom(15);
                },
                () => {
                  alert("위치 정보를 가져올 수 없습니다.");
                }
              );
            }}
            aria-label="현재 위치로 이동"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-gray-700"
            >
              <circle cx="12" cy="12" r="4" />
              <line x1="12" y1="2" x2="12" y2="6" />
              <line x1="12" y1="18" x2="12" y2="22" />
              <line x1="2" y1="12" x2="6" y2="12" />
              <line x1="18" y1="12" x2="22" y2="12" />
            </svg>
          </button>
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
      <BottomSheet expandOnContent={!!searchResult} fullHeight={!!selectedPlace}>
        {selectedPlace ? (
          <PlaceDetail
            place={selectedPlace}
            onClose={() => setSelectedPlace(null)}
            regionName={regionName}
            displayRank={selectedDisplayRank}
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
      </>
      )}
    </div>
  );
}
