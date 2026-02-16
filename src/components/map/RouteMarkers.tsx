"use client";

import { useEffect, useRef } from "react";
import type { SearchResult } from "@/types/place";

// Marker circle colors (per stop order)
const MARKER_COLORS = [
  "#3B82F6", // 1: blue
  "#EF4444", // 2: red
  "#F59E0B", // 3: amber
  "#10B981", // 4: emerald
  "#8B5CF6", // 5: violet
];

// Route segment colors — high contrast between consecutive segments
const ROUTE_COLORS = [
  "#EF4444", // segment 1→2: red
  "#2563EB", // segment 2→3: vivid blue
  "#16A34A", // segment 3→4: green
  "#9333EA", // segment 4→5: purple
  "#EA580C", // segment 5→6: orange
];

function getMarkerColor(order: number): string {
  return MARKER_COLORS[(order - 1) % MARKER_COLORS.length];
}

function getRouteColor(segmentIndex: number): string {
  return ROUTE_COLORS[segmentIndex % ROUTE_COLORS.length];
}

interface WalkingSegment {
  path: { lat: number; lng: number }[];
  distance: number;
  duration: number;
}

async function getWalkingSegments(
  stops: { lat: number; lng: number }[]
): Promise<WalkingSegment[] | null> {
  if (stops.length < 2) return null;

  const segments = await Promise.all(
    stops.slice(0, -1).map(async (from, i) => {
      const to = stops[i + 1];
      const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
      const url = `https://router.project-osrm.org/route/v1/foot/${coords}?overview=full&geometries=geojson&steps=false`;

      try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.code !== "Ok" || !data.routes?.[0]) return null;

        const route = data.routes[0];
        const path = route.geometry.coordinates.map(
          ([lng, lat]: [number, number]) => ({ lat, lng })
        );
        return {
          path,
          distance: Math.round(route.distance),
          duration: Math.round(route.duration),
        };
      } catch {
        return null;
      }
    })
  );

  if (segments.some((s) => s === null)) return null;
  return segments as WalkingSegment[];
}

interface RouteMarkersProps {
  map: naver.maps.Map;
  searchResult: SearchResult;
}

export default function RouteMarkers({ map, searchResult }: RouteMarkersProps) {
  const markersRef = useRef<naver.maps.Marker[]>([]);
  const distLabelsRef = useRef<naver.maps.Marker[]>([]);
  const polylinesRef = useRef<naver.maps.Polyline[]>([]);

  useEffect(() => {
    if (!map || !searchResult.places.length) return;

    // Clean previous
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    distLabelsRef.current.forEach((m) => m.setMap(null));
    distLabelsRef.current = [];
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    const placeMap = new Map(searchResult.places.map((p) => [p.id, p]));

    // Ordered stops with place references
    const stops = searchResult.recommendations
      .map((rec) => {
        const place = placeMap.get(rec.id);
        return place ? { place, rec } : null;
      })
      .filter((s): s is NonNullable<typeof s> => !!s);

    if (stops.length === 0) return;

    // Create numbered circle markers with order-based colors
    stops.forEach(({ place, rec }) => {
      const color = getMarkerColor(rec.order);
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
    const totalWaypoints = positions.length;

    getWalkingSegments(positions).then((segments) => {
      if (segments) {
        // Draw each segment as a separate colored polyline
        segments.forEach((seg, i) => {
          const isReturnLeg = firstIsParking && i === totalWaypoints - 2;
          const segColor = isReturnLeg
            ? getMarkerColor(1) // return to parking uses parking color
            : getRouteColor(i);

          const path = seg.path.map(
            (p) => new naver.maps.LatLng(p.lat, p.lng)
          );
          const polyline = new naver.maps.Polyline({
            map,
            path,
            strokeColor: segColor,
            strokeWeight: 5,
            strokeOpacity: 0.85,
            strokeStyle: isReturnLeg ? "shortdash" : "solid",
          });
          polylinesRef.current.push(polyline);

          // Distance label
          const fromPos = positions[i];
          const toPos = positions[i + 1];
          if (!toPos) return;

          const midLat = (fromPos.lat + toPos.lat) / 2;
          const midLng = (fromPos.lng + toPos.lng) / 2;
          const minutes = Math.max(1, Math.ceil(seg.duration / 60));
          const distText =
            seg.distance >= 1000
              ? `${(seg.distance / 1000).toFixed(1)}km`
              : `${seg.distance}m`;

          const label = isReturnLeg
            ? `🅿️ ${distText} · ${minutes}분 복귀`
            : `🚶 ${distText} · ${minutes}분`;

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
                color:${segColor};
                border:1.5px solid ${segColor}40;
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
        // Fallback: straight dashed lines per segment
        for (let i = 0; i < positions.length - 1; i++) {
          const from = positions[i];
          const to = positions[i + 1];
          const isReturnLeg = firstIsParking && i === positions.length - 2;
          const segColor = isReturnLeg
            ? getMarkerColor(1)
            : getRouteColor(i);

          const polyline = new naver.maps.Polyline({
            map,
            path: [
              new naver.maps.LatLng(from.lat, from.lng),
              new naver.maps.LatLng(to.lat, to.lng),
            ],
            strokeColor: segColor,
            strokeWeight: 3,
            strokeOpacity: 0.7,
            strokeStyle: "shortdash",
          });
          polylinesRef.current.push(polyline);

          const straight = calcDistanceM(from.lat, from.lng, to.lat, to.lng);
          const walking = Math.round(straight * 1.3);
          const minutes = Math.max(1, Math.ceil(walking / 80));
          const distText =
            walking >= 1000
              ? `${(walking / 1000).toFixed(1)}km`
              : `${walking}m`;

          const midLat = (from.lat + to.lat) / 2;
          const midLng = (from.lng + to.lng) / 2;

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
                color:${segColor};
                border:1.5px solid ${segColor}40;
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
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
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
