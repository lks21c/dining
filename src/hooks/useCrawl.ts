"use client";

import { useState, useCallback, useRef } from "react";
import type { Bounds } from "@/types/place";

interface CrawlResult {
  count: number;
  parkingAdded: number;
  keyword: string;
}

export interface CrawlProgress {
  step: string;
  message: string;
  percent: number;
}

export function useCrawl() {
  const [crawling, setCrawling] = useState(false);
  const [crawlResult, setCrawlResult] = useState<CrawlResult | null>(null);
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [crawlProgress, setCrawlProgress] = useState<CrawlProgress | null>(null);
  const cooldownRef = useRef(false);

  const crawl = useCallback(async (keyword: string, bounds: Bounds | null) => {
    if (!keyword.trim() || crawling || cooldownRef.current) return;

    setCrawling(true);
    setCrawlError(null);
    setCrawlResult(null);
    setCrawlProgress(null);

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

      const reader = res.body?.getReader();
      if (!reader) throw new Error("스트림을 읽을 수 없습니다.");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const dataLine = line.replace(/^data: /, "").trim();
          if (!dataLine) continue;

          try {
            const evt = JSON.parse(dataLine);

            switch (evt.step) {
              case "searching":
                setCrawlProgress({ step: evt.step, message: evt.message, percent: 10 });
                break;
              case "fetched":
                setCrawlProgress({ step: evt.step, message: evt.message, percent: 40 });
                break;
              case "geocoding": {
                const geo = evt.total > 0
                  ? 40 + Math.round((evt.progress / evt.total) * 30)
                  : 60;
                setCrawlProgress({ step: evt.step, message: evt.message, percent: Math.min(geo, 70) });
                break;
              }
              case "classifying":
                setCrawlProgress({ step: evt.step, message: evt.message, percent: 75 });
                break;
              case "saving":
                setCrawlProgress({ step: evt.step, message: evt.message, percent: 85 });
                break;
              case "done":
                setCrawlProgress({ step: "done", message: "완료!", percent: 100 });
                setCrawlResult({ count: evt.count, parkingAdded: evt.parkingAdded, keyword: evt.keyword });
                break;
              case "error":
                setCrawlError(evt.message);
                break;
            }
          } catch {
            // skip malformed events
          }
        }
      }

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

  return { crawling, crawlResult, crawlError, crawlProgress, crawl, setCrawlResult };
}
