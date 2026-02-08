"use client";

import { useState, useCallback } from "react";
import type { Bounds, SearchResult } from "@/types/place";

export function useSearch() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(
    async (searchQuery: string, bounds: Bounds | null) => {
      if (!searchQuery.trim() || !bounds) return;

      setSearching(true);
      setError(null);
      try {
        const res = await fetch("/api/places/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: searchQuery, bounds }),
        });
        if (!res.ok) {
          const msg = await res.text();
          throw new Error(msg || "검색에 실패했습니다");
        }
        const data: SearchResult = await res.json();
        setResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "검색에 실패했습니다");
        setResult(null);
      } finally {
        setSearching(false);
      }
    },
    []
  );

  const clearSearch = useCallback(() => {
    setResult(null);
    setQuery("");
    setError(null);
  }, []);

  return { query, setQuery, result, searching, error, search, clearSearch };
}
