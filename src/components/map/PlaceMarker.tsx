"use client";

import { useEffect, useRef } from "react";
import type { Place } from "@/types/place";

const MARKER_COLORS: Record<string, string> = {
  restaurant: "#EF4444",
  cafe: "#92400E",
  parking: "#3B82F6",
};

const MARKER_EMOJI: Record<string, string> = {
  parking: "🅿️",
};

function getTag(place: Place): string {
  if (place.type === "parking") return "";
  // tags 우선 → category/specialty 폴백
  if ("tags" in place && place.tags) return place.tags;
  if (place.type === "restaurant") return place.category || "";
  if (place.type === "cafe") return place.specialty || "";
  return "";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 말풍선 마커 (restaurant / cafe) */
function buildBubbleIcon(place: Place, color: string): { content: string; anchor: naver.maps.Point } {
  const name = escapeHtml(place.name);
  const tag = getTag(place);
  const tagHtml = tag
    ? `<span style="color:#999;font-weight:400;"> ${escapeHtml(tag)}</span>`
    : "";
  const rankHtml =
    "diningcodeRank" in place && place.diningcodeRank != null
      ? `<span style="background:#FFF7ED;color:#C2410C;font-weight:600;font-size:10px;padding:0 4px;border-radius:3px;margin-left:4px;">${place.diningcodeRank}위</span>`
      : "";

  // anchor (0,0) = wrapper origin = 꼭지점 위치 → 말풍선은 translate로 위에 띄움
  const content = `<div style="width:0;height:0;cursor:pointer;">
    <div style="
      position:absolute;
      bottom:0;left:0;
      transform:translateX(-50%);
      display:flex;flex-direction:column;align-items:center;
    ">
      <div style="
        background:white;
        padding:3px 7px;
        border-radius:4px;
        border-left:3px solid ${color};
        font-size:12px;line-height:1.4;
        white-space:nowrap;
        box-shadow:0 1px 4px rgba(0,0,0,0.18);
      "><span style="font-weight:700;color:#222;">${name}</span>${rankHtml}${tagHtml}</div>
      <div style="
        width:0;height:0;
        border-left:5px solid transparent;
        border-right:5px solid transparent;
        border-top:5px solid white;
        filter:drop-shadow(0 1px 1px rgba(0,0,0,0.08));
      "></div>
    </div>
  </div>`;

  return { content, anchor: new naver.maps.Point(0, 0) };
}

/** 원형 아이콘 마커 (parking) */
function buildCircleIcon(color: string, emoji: string): { content: string; anchor: naver.maps.Point } {
  const content = `<div style="
    display:flex;align-items:center;justify-content:center;
    width:36px;height:36px;
    background:${color};
    border-radius:50%;
    border:2px solid white;
    box-shadow:0 2px 6px rgba(0,0,0,0.3);
    font-size:18px;cursor:pointer;
  ">${emoji}</div>`;

  return { content, anchor: new naver.maps.Point(18, 18) };
}

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

    const icon =
      place.type === "parking"
        ? buildCircleIcon(color, MARKER_EMOJI.parking)
        : buildBubbleIcon(place, color);

    const marker = new naver.maps.Marker({
      position: new naver.maps.LatLng(place.lat, place.lng),
      map,
      icon,
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
