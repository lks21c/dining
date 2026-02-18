import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { classifyAndPersist } from "@/lib/classify";
import {
  mapSeedPlaces,
  mapCrawledToPlaces,
  rankByDiningCode,
  deduplicatePlaces,
} from "@/lib/place-mapper";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const swLat = parseFloat(searchParams.get("swLat") || "0");
  const swLng = parseFloat(searchParams.get("swLng") || "0");
  const neLat = parseFloat(searchParams.get("neLat") || "0");
  const neLng = parseFloat(searchParams.get("neLng") || "0");

  if (!swLat && !swLng && !neLat && !neLng) {
    return NextResponse.json(
      { error: "Bounds parameters required" },
      { status: 400 }
    );
  }

  const boundsWhere = {
    lat: { gte: swLat, lte: neLat },
    lng: { gte: swLng, lte: neLng },
  };

  const [restaurants, cafes, parkingLots, crawledPlaces] = await Promise.all([
    prisma.restaurant.findMany({ where: boundsWhere }),
    prisma.cafe.findMany({ where: boundsWhere }),
    prisma.parkingLot.findMany({ where: boundsWhere }),
    prisma.crawledPlace.findMany({
      where: {
        lat: { gte: swLat, lte: neLat, not: null },
        lng: { gte: swLng, lte: neLng, not: null },
      },
      include: { sources: true },
    }),
  ]);

  const seedPlaces = mapSeedPlaces(restaurants, cafes, parkingLots);

  // Classify unclassified crawled places via LLM and persist to DB
  const validCrawled = crawledPlaces.filter(
    (cp) => cp.lat != null && cp.lng != null
  );
  const unclassified = validCrawled.filter((cp) => !cp.placeType);
  let llmTypeMap: Record<string, string> = {};
  if (unclassified.length > 0) {
    llmTypeMap = await classifyAndPersist(
      unclassified.map((cp) => ({
        id: cp.id,
        name: cp.name,
        category: cp.category,
        tags: cp.tags,
        description: cp.description,
      }))
    );
  }

  const crawledAsPlaces = mapCrawledToPlaces(crawledPlaces, llmTypeMap);
  rankByDiningCode(crawledAsPlaces, crawledPlaces);
  const places = deduplicatePlaces(seedPlaces, crawledAsPlaces);

  return NextResponse.json(places);
}
