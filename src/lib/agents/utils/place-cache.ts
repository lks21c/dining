import { prisma } from "@/lib/prisma";
import type { Bounds } from "@/types/place";
import type { RawCrawledPlace } from "../state";

/**
 * Find cached crawled places within bounds and within maxAge hours.
 */
export async function findCachedPlaces(
  bounds: Bounds | null,
  maxAgeHours = 24
): Promise<RawCrawledPlace[]> {
  const since = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

  const where: Record<string, unknown> = {
    updatedAt: { gte: since },
    lat: { not: null },
    lng: { not: null },
  };

  if (bounds) {
    where.lat = { gte: bounds.swLat, lte: bounds.neLat, not: null };
    where.lng = { gte: bounds.swLng, lte: bounds.neLng, not: null };
  }

  const cached = await prisma.crawledPlace.findMany({
    where,
    include: { sources: true },
  });

  return cached.map((cp) => ({
    name: cp.name,
    category: cp.category ?? undefined,
    description: cp.description ?? undefined,
    address: cp.address ?? undefined,
    lat: cp.lat ?? undefined,
    lng: cp.lng ?? undefined,
    rating: cp.sources[0]?.rating ?? undefined,
    reviewCount: cp.sources[0]?.reviewCount ?? undefined,
    source: cp.sources[0]?.source ?? "cache",
    sourceUrl: cp.sources[0]?.sourceUrl ?? undefined,
    snippet: cp.sources[0]?.snippet ?? undefined,
    tags: cp.tags ?? undefined,
  }));
}

interface MergedPlaceForSave {
  name: string;
  category?: string;
  description?: string;
  address?: string;
  lat?: number;
  lng?: number;
  tags?: string;
  sources: {
    source: string;
    sourceUrl?: string;
    rating?: number;
    reviewCount?: number;
    snippet?: string;
  }[];
}

/**
 * Save merged crawled places to DB (upsert by name).
 */
export async function saveCrawledPlaces(
  places: MergedPlaceForSave[]
): Promise<void> {
  for (const place of places) {
    try {
      // Find existing by name
      const existing = await prisma.crawledPlace.findFirst({
        where: { name: place.name },
      });

      if (existing) {
        // Update the main record
        await prisma.crawledPlace.update({
          where: { id: existing.id },
          data: {
            category: place.category ?? existing.category,
            description: place.description ?? existing.description,
            address: place.address ?? existing.address,
            lat: place.lat ?? existing.lat,
            lng: place.lng ?? existing.lng,
            tags: place.tags ?? existing.tags,
          },
        });

        // Upsert sources
        for (const src of place.sources) {
          await prisma.placeSource.upsert({
            where: {
              crawledPlaceId_source: {
                crawledPlaceId: existing.id,
                source: src.source,
              },
            },
            update: {
              sourceUrl: src.sourceUrl,
              rating: src.rating,
              reviewCount: src.reviewCount,
              snippet: src.snippet,
              crawledAt: new Date(),
            },
            create: {
              crawledPlaceId: existing.id,
              source: src.source,
              sourceUrl: src.sourceUrl,
              rating: src.rating,
              reviewCount: src.reviewCount,
              snippet: src.snippet,
            },
          });
        }
      } else {
        // Create new
        await prisma.crawledPlace.create({
          data: {
            name: place.name,
            category: place.category,
            description: place.description,
            address: place.address,
            lat: place.lat,
            lng: place.lng,
            tags: place.tags,
            sources: {
              create: place.sources.map((src) => ({
                source: src.source,
                sourceUrl: src.sourceUrl,
                rating: src.rating,
                reviewCount: src.reviewCount,
                snippet: src.snippet,
              })),
            },
          },
        });
      }
    } catch (error) {
      console.error(`Failed to save place "${place.name}":`, error);
    }
  }
}
