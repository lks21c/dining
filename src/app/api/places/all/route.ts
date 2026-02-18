import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  mapSeedPlaces,
  mapCrawledToPlaces,
  rankByDiningCode,
  deduplicatePlaces,
  extractRegion,
} from "@/lib/place-mapper";
import type { Place } from "@/types/place";

export type PlaceWithRegion = Place & { region: string };

export async function GET() {
  const [restaurants, cafes, parkingLots, crawledPlaces] = await Promise.all([
    prisma.restaurant.findMany(),
    prisma.cafe.findMany(),
    prisma.parkingLot.findMany(),
    prisma.crawledPlace.findMany({
      where: {
        lat: { not: null },
        lng: { not: null },
      },
      include: { sources: true },
    }),
  ]);

  const seedPlaces = mapSeedPlaces(restaurants, cafes, parkingLots);
  const crawledAsPlaces = mapCrawledToPlaces(crawledPlaces);
  rankByDiningCode(crawledAsPlaces, crawledPlaces);
  const rankedCrawled = crawledAsPlaces.filter(
    (p) => p.type === "parking" || p.diningcodeRank != null
  );
  const allPlaces = deduplicatePlaces(seedPlaces, rankedCrawled);

  // Build address lookup from crawled places
  const addressMap = new Map<string, string>();
  for (const cp of crawledPlaces) {
    if (cp.address) {
      addressMap.set(cp.id, cp.address);
    }
  }
  // Also include parking lot addresses
  for (const p of parkingLots) {
    if (p.address) {
      addressMap.set(p.id, p.address);
    }
  }

  // Add region to each place
  const placesWithRegion: PlaceWithRegion[] = allPlaces.map((p) => ({
    ...p,
    region: extractRegion(addressMap.get(p.id)),
  }));

  // Collect unique regions sorted
  const regionSet = new Set<string>();
  for (const p of placesWithRegion) {
    if (p.region !== "기타") {
      regionSet.add(p.region);
    }
  }
  const regions = Array.from(regionSet).sort((a, b) => a.localeCompare(b, "ko"));

  return NextResponse.json({
    places: placesWithRegion,
    regions,
    totalCount: placesWithRegion.length,
  });
}
