"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const SEOUL_CENTER = { lat: 37.5175, lng: 127.0000 };
const DEFAULT_ZOOM = 14;

export function useNaverMap(mapElementId: string) {
  const mapRef = useRef<naver.maps.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const initMap = useCallback(() => {
    const el = document.getElementById(mapElementId);
    if (!el || !window.naver?.maps) return;
    if (mapRef.current) return;

    mapRef.current = new naver.maps.Map(el, {
      center: new naver.maps.LatLng(SEOUL_CENTER.lat, SEOUL_CENTER.lng),
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      zoomControlOptions: {
        position: naver.maps.Position.TOP_RIGHT,
      },
      mapTypeControl: false,
      scaleControl: false,
    });

    setIsLoaded(true);
  }, [mapElementId]);

  useEffect(() => {
    if (window.naver?.maps) {
      initMap();
      return;
    }

    const interval = setInterval(() => {
      if (window.naver?.maps) {
        clearInterval(interval);
        initMap();
      }
    }, 100);

    return () => {
      clearInterval(interval);
    };
  }, [initMap]);

  return { map: mapRef.current, isLoaded };
}
