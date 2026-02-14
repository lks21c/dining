"use client";

import { useEffect, useState, useMemo } from "react";
import type { Place, PlaceType } from "@/types/place";

type PlaceWithRegion = Place & { region: string };

interface AllPlacesResponse {
  places: PlaceWithRegion[];
  regions: string[];
  totalCount: number;
}

export function useAllPlaces(enabled: boolean) {
  const [allPlaces, setAllPlaces] = useState<PlaceWithRegion[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedType, setSelectedType] = useState<PlaceType | "all">("all");
  const [nameQuery, setNameQuery] = useState("");

  useEffect(() => {
    if (!enabled || fetched) return;

    let cancelled = false;
    setLoading(true);

    fetch("/api/places/all")
      .then((res) => res.json())
      .then((data: AllPlacesResponse) => {
        if (cancelled) return;
        setAllPlaces(data.places);
        setRegions(data.regions);
        setFetched(true);
      })
      .catch((err) => {
        console.error("Error fetching all places:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, fetched]);

  const filteredPlaces = useMemo(() => {
    let result = allPlaces;

    if (selectedRegion) {
      result = result.filter((p) => p.region === selectedRegion);
    }

    if (selectedType !== "all") {
      result = result.filter((p) => p.type === selectedType);
    }

    if (nameQuery.trim()) {
      const q = nameQuery.trim().toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q));
    }

    return result;
  }, [allPlaces, selectedRegion, selectedType, nameQuery]);

  return {
    places: filteredPlaces,
    regions,
    loading,
    selectedRegion,
    selectedType,
    nameQuery,
    setSelectedRegion,
    setSelectedType,
    setNameQuery,
    totalCount: allPlaces.length,
    filteredCount: filteredPlaces.length,
  };
}
