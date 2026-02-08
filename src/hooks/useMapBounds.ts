"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type { Bounds } from "@/types/place";

export function useMapBounds(map: naver.maps.Map | null) {
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [shouldSearch, setShouldSearch] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadRef = useRef(true);

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

    // Initial bounds
    const initialBounds = getBoundsFromMap(map);
    setBounds(initialBounds);
    initialLoadRef.current = false;

    const listener = naver.maps.Event.addListener(map, "idle", () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        if (initialLoadRef.current) {
          initialLoadRef.current = false;
          setBounds(getBoundsFromMap(map));
        } else {
          setShouldSearch(true);
        }
      }, 300);
    });

    return () => {
      naver.maps.Event.removeListener(listener);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [map, getBoundsFromMap]);

  const searchThisArea = useCallback(() => {
    if (!map) return;
    setBounds(getBoundsFromMap(map));
    setShouldSearch(false);
  }, [map, getBoundsFromMap]);

  return { bounds, shouldSearch, searchThisArea };
}
