import { calcDistanceM } from "@/lib/llm";
import type { RawCrawledPlace } from "../state";

import { normalizeName } from "@/lib/normalize";
// Re-export for backward compatibility
export { normalizeName };

/**
 * Check if two places are the same:
 * - normalized names match AND
 * - if both have coordinates, within 200m
 */
export function isSamePlace(a: RawCrawledPlace, b: RawCrawledPlace): boolean {
  const nameA = normalizeName(a.name);
  const nameB = normalizeName(b.name);

  if (nameA !== nameB) return false;

  // If both have coords, check distance
  if (
    a.lat != null &&
    a.lng != null &&
    b.lat != null &&
    b.lng != null
  ) {
    const dist = calcDistanceM(a.lat, a.lng, b.lat, b.lng);
    return dist <= 200;
  }

  // Same name, no coords to compare — treat as same
  return true;
}

interface MergedPlace extends RawCrawledPlace {
  sources: { source: string; sourceUrl?: string; rating?: number; reviewCount?: number; snippet?: string; metadata?: string }[];
}

/**
 * Deduplicate crawled places:
 * - group by normalized name + proximity
 * - merge sources
 * - pick the most complete data as the base
 */
export function deduplicatePlaces(places: RawCrawledPlace[]): MergedPlace[] {
  const groups: MergedPlace[] = [];

  for (const place of places) {
    const existing = groups.find((g) => isSamePlace(g, place));

    if (existing) {
      // Merge source info
      const alreadyHasSource = existing.sources.some(
        (s) => s.source === place.source
      );
      if (!alreadyHasSource) {
        existing.sources.push({
          source: place.source,
          sourceUrl: place.sourceUrl,
          rating: place.rating,
          reviewCount: place.reviewCount,
          snippet: place.snippet,
          metadata: place.metadata,
        });
      }

      // Fill in missing fields from the new place
      if (!existing.lat && place.lat) existing.lat = place.lat;
      if (!existing.lng && place.lng) existing.lng = place.lng;
      if (!existing.address && place.address) existing.address = place.address;
      if (!existing.category && place.category) existing.category = place.category;
      if (!existing.rating && place.rating) existing.rating = place.rating;
      if (!existing.tags && place.tags) existing.tags = place.tags;
    } else {
      groups.push({
        ...place,
        sources: [
          {
            source: place.source,
            sourceUrl: place.sourceUrl,
            rating: place.rating,
            reviewCount: place.reviewCount,
            snippet: place.snippet,
            metadata: place.metadata,
          },
        ],
      });
    }
  }

  return groups;
}
