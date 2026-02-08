"use client";

import { useEffect, useRef } from "react";
import type { Place } from "@/types/place";

const MARKER_COLORS: Record<string, string> = {
  restaurant: "#EF4444",
  cafe: "#92400E",
  parking: "#3B82F6",
};

const MARKER_EMOJI: Record<string, string> = {
  restaurant: "🍽️",
  cafe: "☕",
  parking: "🅿️",
};

interface PlaceMarkerProps {
  map: naver.maps.Map;
  place: Place;
  onClick?: (place: Place) => void;
}

export default function PlaceMarker({ map, place, onClick }: PlaceMarkerProps) {
  const markerRef = useRef<naver.maps.Marker | null>(null);

  useEffect(() => {
    if (!map) return;

    const color = MARKER_COLORS[place.type];
    const emoji = MARKER_EMOJI[place.type];

    const marker = new naver.maps.Marker({
      position: new naver.maps.LatLng(place.lat, place.lng),
      map,
      icon: {
        content: `<div style="
          display:flex;align-items:center;justify-content:center;
          width:36px;height:36px;
          background:${color};
          border-radius:50%;
          border:2px solid white;
          box-shadow:0 2px 6px rgba(0,0,0,0.3);
          font-size:18px;
          cursor:pointer;
        ">${emoji}</div>`,
        anchor: new naver.maps.Point(18, 18),
      },
    });

    if (onClick) {
      naver.maps.Event.addListener(marker, "click", () => onClick(place));
    }

    markerRef.current = marker;

    return () => {
      marker.setMap(null);
    };
  }, [map, place, onClick]);

  return null;
}
