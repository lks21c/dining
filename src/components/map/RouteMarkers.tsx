"use client";

import { useEffect, useRef } from "react";
import type { SearchResult } from "@/types/place";

const TYPE_COLORS: Record<string, string> = {
  restaurant: "#EF4444",
  cafe: "#92400E",
  parking: "#3B82F6",
};

interface RouteMarkersProps {
  map: naver.maps.Map;
  searchResult: SearchResult;
}

export default function RouteMarkers({ map, searchResult }: RouteMarkersProps) {
  const markersRef = useRef<naver.maps.Marker[]>([]);
  const polylineRef = useRef<naver.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map || !searchResult.places.length) return;

    // Clean previous
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    polylineRef.current?.setMap(null);

    const placeMap = new Map(searchResult.places.map((p) => [p.id, p]));
    const path: naver.maps.LatLng[] = [];

    searchResult.recommendations.forEach((rec) => {
      const place = placeMap.get(rec.id);
      if (!place) return;

      const color = TYPE_COLORS[rec.type] || "#6B7280";
      const pos = new naver.maps.LatLng(place.lat, place.lng);
      path.push(pos);

      const marker = new naver.maps.Marker({
        position: pos,
        map,
        zIndex: 100 + rec.order,
        icon: {
          content: `<div style="
            position:relative;
            display:flex;align-items:center;justify-content:center;
            width:40px;height:40px;
            background:${color};
            border-radius:50%;
            border:3px solid white;
            box-shadow:0 3px 8px rgba(0,0,0,0.4);
            color:white;
            font-weight:bold;
            font-size:18px;
            cursor:pointer;
          ">${rec.order}</div>`,
          anchor: new naver.maps.Point(20, 20),
        },
      });

      markersRef.current.push(marker);
    });

    // Draw dashed polyline connecting route
    if (path.length > 1) {
      polylineRef.current = new naver.maps.Polyline({
        map,
        path,
        strokeColor: "#6366F1",
        strokeWeight: 3,
        strokeOpacity: 0.7,
        strokeStyle: "shortdash",
      });
    }

    // Fit bounds to show all markers
    if (path.length > 0) {
      const lats = path.map((p) => p.lat());
      const lngs = path.map((p) => p.lng());
      const sw = new naver.maps.LatLng(Math.min(...lats) - 0.002, Math.min(...lngs) - 0.002);
      const ne = new naver.maps.LatLng(Math.max(...lats) + 0.002, Math.max(...lngs) + 0.002);
      map.panTo(new naver.maps.LatLng(
        (sw.lat() + ne.lat()) / 2,
        (sw.lng() + ne.lng()) / 2
      ));
    }

    return () => {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      polylineRef.current?.setMap(null);
      polylineRef.current = null;
    };
  }, [map, searchResult]);

  return null;
}
