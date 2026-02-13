"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type { Bounds } from "@/types/place";

/** Minimum zoom level to show place markers (neighborhood level) */
export const MIN_MARKER_ZOOM = 16;

export function useMapBounds(map: naver.maps.Map | null) {
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [zoom, setZoom] = useState(14);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getBoundsFromMap = useCallback((mapInstance: naver.maps.Map): Bounds => {
    const b = mapInstance.getBounds();
    const sw = b.getSW();
    const ne = b.getNE();
    return {
      swLat: sw.lat(),
      swLng: sw.lng(),
      neLat: ne.lat(),
      neLng: ne.lng(),
    };
  }, []);

  useEffect(() => {
    if (!map) return;

    // Initial check
    const initialZoom = map.getZoom();
    setZoom(initialZoom);
    if (initialZoom >= MIN_MARKER_ZOOM) {
      setBounds(getBoundsFromMap(map));
    }

    // Auto-update on idle (pan/zoom)
    const listener = naver.maps.Event.addListener(map, "idle", () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        const currentZoom = map.getZoom();
        setZoom(currentZoom);
        if (currentZoom >= MIN_MARKER_ZOOM) {
          setBounds(getBoundsFromMap(map));
        } else {
          setBounds(null); // zoomed out → clear places
        }
      }, 300);
    });

    return () => {
      naver.maps.Event.removeListener(listener);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [map, getBoundsFromMap]);

  /** Manual refresh (e.g. after crawl) */
  const searchThisArea = useCallback(() => {
    if (!map) return;
    setBounds(getBoundsFromMap(map));
  }, [map, getBoundsFromMap]);

  return { bounds, zoom, searchThisArea };
}
