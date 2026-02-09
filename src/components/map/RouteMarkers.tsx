"use client";

import { useEffect, useRef } from "react";
import type { SearchResult } from "@/types/place";

const TYPE_COLORS: Record<string, string> = {
  restaurant: "#EF4444",
  cafe: "#92400E",
  parking: "#3B82F6",
};

interface WalkingLeg {
  distance: number; // meters
  duration: number; // seconds
}

interface WalkingRoute {
  path: { lat: number; lng: number }[];
  legs: WalkingLeg[];
}

async function getWalkingRoute(
  stops: { lat: number; lng: number }[]
): Promise<WalkingRoute | null> {
  if (stops.length < 2) return null;

  const coords = stops.map((s) => `${s.lng},${s.lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/foot/${coords}?overview=full&geometries=geojson&steps=false`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.code !== "Ok" || !data.routes?.[0]) return null;

    const route = data.routes[0];
    const path = route.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => ({ lat, lng })
    );
    const legs: WalkingLeg[] = route.legs.map(
      (leg: { distance: number; duration: number }) => ({
        distance: Math.round(leg.distance),
        duration: Math.round(leg.duration),
      })
    );

    return { path, legs };
  } catch {
    return null;
  }
}

interface RouteMarkersProps {
  map: naver.maps.Map;
  searchResult: SearchResult;
}

export default function RouteMarkers({ map, searchResult }: RouteMarkersProps) {
  const markersRef = useRef<naver.maps.Marker[]>([]);
  const distLabelsRef = useRef<naver.maps.Marker[]>([]);
  const polylineRef = useRef<naver.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map || !searchResult.places.length) return;

    // Clean previous
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    distLabelsRef.current.forEach((m) => m.setMap(null));
    distLabelsRef.current = [];
    polylineRef.current?.setMap(null);
    polylineRef.current = null;

    const placeMap = new Map(searchResult.places.map((p) => [p.id, p]));

    // Ordered stops with place references
    const stops = searchResult.recommendations
      .map((rec) => {
        const place = placeMap.get(rec.id);
        return place ? { place, rec } : null;
      })
      .filter((s): s is NonNullable<typeof s> => !!s);

    if (stops.length === 0) return;

    // Create numbered circle markers
    stops.forEach(({ place, rec }) => {
      const color = TYPE_COLORS[rec.type] || "#6B7280";
      const pos = new naver.maps.LatLng(place.lat, place.lng);

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

    // Build route positions — if first stop is parking, append it at the end for return trip
    const positions = stops.map((s) => ({
      lat: s.place.lat,
      lng: s.place.lng,
    }));
    const firstIsParking = stops[0].rec.type === "parking";
    if (firstIsParking && stops.length > 1) {
      positions.push({ lat: stops[0].place.lat, lng: stops[0].place.lng });
    }
    // Total waypoint count including return (for label logic)
    const totalWaypoints = positions.length;

    getWalkingRoute(positions).then((route) => {
      if (route) {
        // Draw actual walking route
        const path = route.path.map(
          (p) => new naver.maps.LatLng(p.lat, p.lng)
        );
        polylineRef.current = new naver.maps.Polyline({
          map,
          path,
          strokeColor: "#6366F1",
          strokeWeight: 4,
          strokeOpacity: 0.8,
          strokeStyle: "solid",
        });

        // Add distance labels between each pair of waypoints
        route.legs.forEach((leg, i) => {
          const fromPos = positions[i];
          const toPos = positions[i + 1];
          if (!toPos) return;

          const midLat = (fromPos.lat + toPos.lat) / 2;
          const midLng = (fromPos.lng + toPos.lng) / 2;
          const minutes = Math.max(1, Math.ceil(leg.duration / 60));
          const distText =
            leg.distance >= 1000
              ? `${(leg.distance / 1000).toFixed(1)}km`
              : `${leg.distance}m`;

          // Last leg = return to parking
          const isReturnLeg = firstIsParking && i === totalWaypoints - 2;
          const label = isReturnLeg
            ? `🅿️ ${distText} · ${minutes}분 복귀`
            : `🚶 ${distText} · ${minutes}분`;
          const color = isReturnLeg ? "#3B82F6" : "#4F46E5";
          const borderColor = isReturnLeg ? "#BFDBFE" : "#C7D2FE";

          const labelMarker = new naver.maps.Marker({
            position: new naver.maps.LatLng(midLat, midLng),
            map,
            zIndex: 90,
            icon: {
              content: `<div style="
                background:white;
                padding:3px 8px;
                border-radius:12px;
                font-size:11px;
                color:${color};
                border:1.5px solid ${borderColor};
                white-space:nowrap;
                font-weight:600;
                box-shadow:0 2px 6px rgba(0,0,0,0.15);
                pointer-events:none;
              ">${label}</div>`,
              anchor: new naver.maps.Point(40, 10),
            },
          });

          distLabelsRef.current.push(labelMarker);
        });
      } else {
        // Fallback: straight dashed line (including return leg)
        const path = positions.map(
          (p) => new naver.maps.LatLng(p.lat, p.lng)
        );
        polylineRef.current = new naver.maps.Polyline({
          map,
          path,
          strokeColor: "#6366F1",
          strokeWeight: 3,
          strokeOpacity: 0.7,
          strokeStyle: "shortdash",
        });

        // Straight-line distance labels (approximate walking ×1.3)
        for (let i = 0; i < positions.length - 1; i++) {
          const from = positions[i];
          const to = positions[i + 1];
          const straight = calcDistanceM(from.lat, from.lng, to.lat, to.lng);
          const walking = Math.round(straight * 1.3);
          const minutes = Math.max(1, Math.ceil(walking / 80)); // ~80m/min walking
          const distText =
            walking >= 1000
              ? `${(walking / 1000).toFixed(1)}km`
              : `${walking}m`;

          const midLat = (from.lat + to.lat) / 2;
          const midLng = (from.lng + to.lng) / 2;

          const isReturnLeg = firstIsParking && i === positions.length - 2;
          const label = isReturnLeg
            ? `🅿️ ~${distText} · ~${minutes}분 복귀`
            : `~${distText} · ~${minutes}분`;

          const labelMarker = new naver.maps.Marker({
            position: new naver.maps.LatLng(midLat, midLng),
            map,
            zIndex: 90,
            icon: {
              content: `<div style="
                background:white;
                padding:3px 8px;
                border-radius:12px;
                font-size:11px;
                color:${isReturnLeg ? "#3B82F6" : "#9CA3AF"};
                border:1.5px solid ${isReturnLeg ? "#BFDBFE" : "#E5E7EB"};
                white-space:nowrap;
                font-weight:600;
                box-shadow:0 2px 6px rgba(0,0,0,0.1);
                pointer-events:none;
              ">${label}</div>`,
              anchor: new naver.maps.Point(40, 10),
            },
          });

          distLabelsRef.current.push(labelMarker);
        }
      }
    });

    // Fit bounds to show all markers
    const allLats = stops.map((s) => s.place.lat);
    const allLngs = stops.map((s) => s.place.lng);
    if (allLats.length > 0) {
      map.panTo(
        new naver.maps.LatLng(
          (Math.min(...allLats) + Math.max(...allLats)) / 2,
          (Math.min(...allLngs) + Math.max(...allLngs)) / 2
        )
      );
    }

    return () => {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      distLabelsRef.current.forEach((m) => m.setMap(null));
      distLabelsRef.current = [];
      polylineRef.current?.setMap(null);
      polylineRef.current = null;
    };
  }, [map, searchResult]);

  return null;
}

/* Haversine straight-line distance */
function calcDistanceM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
