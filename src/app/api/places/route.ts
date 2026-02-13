import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Place } from "@/types/place";

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

  const seedPlaces: Place[] = [
    ...restaurants.map((r) => ({
      ...r,
      type: "restaurant" as const,
    })),
    ...cafes.map((c) => ({
      ...c,
      type: "cafe" as const,
    })),
    ...parkingLots.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      lat: p.lat,
      lng: p.lng,
      type: "parking" as const,
      parkingType: p.type,
      address: p.address ?? undefined,
      capacity: p.capacity,
      hourlyRate: p.hourlyRate,
      baseTime: p.baseTime ?? undefined,
      baseRate: p.baseRate ?? undefined,
      extraTime: p.extraTime ?? undefined,
      extraRate: p.extraRate ?? undefined,
      freeNote: p.freeNote ?? undefined,
      operatingHours: p.operatingHours,
    })),
  ];

  // Convert crawled places to Place type, detecting cafes by name/category/tags
  const CAFE_PATTERN = /카페|커피|coffee|cafe|베이커리|bakery|디저트|dessert/i;
  const CAFE_CATEGORY_PATTERN = /혼카페|차모임/;

  function isCafe(cp: { name: string; category: string | null; tags: string | null }): boolean {
    if (CAFE_PATTERN.test(cp.name)) return true;
    if (cp.category && CAFE_CATEGORY_PATTERN.test(cp.category)) return true;
    if (cp.tags && CAFE_PATTERN.test(cp.tags)) return true;
    if (cp.tags && CAFE_CATEGORY_PATTERN.test(cp.tags)) return true;
    return false;
  }

  const validCrawled = crawledPlaces.filter((cp) => cp.lat != null && cp.lng != null);
  const crawledAsPlaces: Place[] = validCrawled
    .map((cp) => {
      const cafe = isCafe(cp);
      return cafe
        ? {
            id: cp.id,
            name: cp.name,
            description:
              cp.description || cp.sources[0]?.snippet || "다이닝코드 크롤링",
            lat: cp.lat!,
            lng: cp.lng!,
            type: "cafe" as const,
            specialty: cp.category || "카페",
            priceRange: cp.priceRange || "미정",
            atmosphere: cp.atmosphere || "미정",
            goodFor: cp.goodFor || "미정",
            rating: cp.sources[0]?.rating || 0,
            reviewCount: cp.sources[0]?.reviewCount || 0,
            parkingAvailable: false,
            nearbyParking: null,
            tags: cp.tags ?? undefined,
          }
        : {
            id: cp.id,
            name: cp.name,
            description:
              cp.description || cp.sources[0]?.snippet || "다이닝코드 크롤링",
            lat: cp.lat!,
            lng: cp.lng!,
            type: "restaurant" as const,
            category: cp.category || "맛집",
            priceRange: cp.priceRange || "미정",
            atmosphere: cp.atmosphere || "미정",
            goodFor: cp.goodFor || "미정",
            rating: cp.sources[0]?.rating || 0,
            reviewCount: cp.sources[0]?.reviewCount || 0,
            parkingAvailable: false,
            nearbyParking: null,
            tags: cp.tags ?? undefined,
          };
    });

  // Compute DiningCode ranking based on score within this result set
  const withScores = crawledAsPlaces
    .map((p, i) => {
      const dcSource = validCrawled[i]?.sources.find((s) => s.source === "diningcode");
      const meta = dcSource?.metadata;
      let score: number | null = null;
      if (meta) {
        try { score = JSON.parse(meta).score ?? null; } catch { /* ignore */ }
      }
      return { place: p, score };
    })
    .filter((x): x is { place: Place; score: number } => x.score != null)
    .sort((a, b) => b.score - a.score);

  withScores.forEach((x, i) => {
    if (x.place.type === "restaurant" || x.place.type === "cafe") {
      x.place.diningcodeRank = i + 1;
    }
  });

  // Merge: seed + crawled, deduplicate by name
  const seedNames = new Set(seedPlaces.map((p) => p.name.toLowerCase()));
  const uniqueCrawled = crawledAsPlaces.filter(
    (p) => !seedNames.has(p.name.toLowerCase())
  );

  const places: Place[] = [...seedPlaces, ...uniqueCrawled];

  return NextResponse.json(places);
}
