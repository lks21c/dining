"use client";

import { useState, useCallback, useRef } from "react";
import type { Bounds } from "@/types/place";

interface CrawlResult {
  count: number;
  parkingAdded: number;
  keyword: string;
}

export function useCrawl() {
  const [crawling, setCrawling] = useState(false);
  const [crawlResult, setCrawlResult] = useState<CrawlResult | null>(null);
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const cooldownRef = useRef(false);

  const crawl = useCallback(async (keyword: string, bounds: Bounds | null) => {
    if (!keyword.trim() || crawling || cooldownRef.current) return;

    setCrawling(true);
    setCrawlError(null);
    setCrawlResult(null);

    try {
      const res = await fetch("/api/places/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, bounds }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "크롤링 실패");
      }

      const data: CrawlResult = await res.json();
      setCrawlResult(data);

      // 10-second cooldown
      cooldownRef.current = true;
      setTimeout(() => {
        cooldownRef.current = false;
      }, 10000);
    } catch (err) {
      setCrawlError(
        err instanceof Error ? err.message : "크롤링 중 오류 발생"
      );
    } finally {
      setCrawling(false);
    }
  }, [crawling]);

  return { crawling, crawlResult, crawlError, crawl, setCrawlResult };
}
