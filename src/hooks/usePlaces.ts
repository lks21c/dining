"use client";

import { useEffect, useState, useCallback } from "react";
import type { Bounds, Place, PlaceType } from "@/types/place";

export function usePlaces(bounds: Bounds | null) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeType, setActiveType] = useState<PlaceType | "all">("all");

  const fetchPlaces = useCallback(async (b: Bounds) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        swLat: String(b.swLat),
        swLng: String(b.swLng),
        neLat: String(b.neLat),
        neLng: String(b.neLng),
      });
      const res = await fetch(`/api/places?${params}`);
      if (!res.ok) throw new Error("Failed to fetch places");
      const data: Place[] = await res.json();
      setPlaces(data);
    } catch (err) {
      console.error("Error fetching places:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (bounds) {
      fetchPlaces(bounds);
    } else {
      setPlaces([]);
    }
  }, [bounds, fetchPlaces]);

  const filteredPlaces =
    activeType === "all"
      ? places
      : places.filter((p) => p.type === activeType);

  return { places: filteredPlaces, allPlaces: places, loading, activeType, setActiveType };
}
