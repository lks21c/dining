import { NextRequest, NextResponse } from "next/server";
import { extractLocation, getRecommendations } from "@/lib/llm";
import { geocode } from "@/lib/geocode";
import { boundsFromCenter } from "@/lib/bounds";
import { prisma } from "@/lib/prisma";
import type { Place } from "@/types/place";

const RADIUS_KM = 1.5;

export async function POST(req: NextRequest) {
  const { query, bounds } = await req.json();

  if (!query) {
    return NextResponse.json(
      { error: "query is required" },
      { status: 400 }
    );
  }

  // 1. Extract location from query
  const { location: locationName, error: locationError } = await extractLocation(query);
  let llmWarning: string | undefined;
  if (locationError) {
    llmWarning = "AI 서비스에 연결할 수 없어 위치를 자동 인식하지 못했습니다. 현재 지도 영역에서 키워드 기반으로 검색합니다.";
  }

  let searchBounds = bounds;
  let center: { lat: number; lng: number; name: string } | undefined;

  // 2. If location found, geocode it
  if (locationName) {
    const geo = await geocode(locationName);
    if (geo) {
      searchBounds = boundsFromCenter(geo.lat, geo.lng, RADIUS_KM);
      center = { lat: geo.lat, lng: geo.lng, name: locationName };
    }
  }

  // 3. Need bounds from either geocoding or map viewport
  if (!searchBounds) {
    return NextResponse.json(
      { error: "위치를 확인할 수 없습니다. 지도에서 검색하거나 위치를 포함해 주세요." },
      { status: 400 }
    );
  }

  // 4. Fast path: query DB directly + call Gemini
  try {
    const boundsWhere = {
      lat: { gte: searchBounds.swLat, lte: searchBounds.neLat },
      lng: { gte: searchBounds.swLng, lte: searchBounds.neLng },
    };

    const [restaurants, cafes, parkingLots, crawledRecords] = await Promise.all([
      prisma.restaurant.findMany({ where: boundsWhere }),
      prisma.cafe.findMany({ where: boundsWhere }),
      prisma.parkingLot.findMany({ where: boundsWhere }),
      prisma.crawledPlace.findMany({
        where: {
          lat: { gte: searchBounds.swLat, lte: searchBounds.neLat },
          lng: { gte: searchBounds.swLng, lte: searchBounds.neLng },
        },
        include: { sources: true },
      }),
    ]);

    // Build Place[]
    const seedPlaces: Place[] = [
      ...restaurants.map((r) => ({ ...r, type: "restaurant" as const })),
      ...cafes.map((c) => ({ ...c, type: "cafe" as const })),
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

    // Add crawled places (avoid duplicates with seed data)
    const seedNames = new Set(seedPlaces.map((p) => p.name.toLowerCase()));
    const validCrawled = crawledRecords
      .filter((cp) => cp.lat && cp.lng && !seedNames.has(cp.name.toLowerCase()));
    const crawledAsPlaces: Place[] = validCrawled
      .map((cp) => ({
        id: cp.id,
        name: cp.name,
        description: cp.description || `${cp.sources.map((s) => s.source).join(", ")}에서 추천`,
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
      }));

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

    const allPlaces = [...seedPlaces, ...crawledAsPlaces];

    if (allPlaces.length === 0) {
      return NextResponse.json({
        summary: "이 지역에 등록된 장소가 없습니다.",
        persona: "",
        courses: [],
        recommendations: [],
        routeSummary: "",
        places: [],
        center,
      });
    }

    // 5. Call Gemini for course-based recommendations
    const anchor = center || undefined;
    const llmResult = await getRecommendations(query, allPlaces, anchor);

    // Collect all referenced place IDs across all courses
    const allPlaceIds = new Set<string>();
    for (const course of llmResult.courses) {
      for (const stop of course.stops) {
        allPlaceIds.add(stop.id);
      }
    }

    const placeMap = new Map(allPlaces.map((p) => [p.id, p]));
    const referencedPlaces = [...allPlaceIds]
      .map((id) => placeMap.get(id))
      .filter((p): p is Place => !!p);

    // Default to first course for RouteMarkers
    const firstCourse = llmResult.courses[0];

    const warning = llmResult.warning || llmWarning;

    return NextResponse.json({
      summary: llmResult.summary,
      persona: llmResult.persona,
      courses: llmResult.courses,
      recommendations: firstCourse?.stops || [],
      routeSummary: firstCourse?.routeSummary || "",
      places: referencedPlaces,
      center,
      ...(warning && { warning }),
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "검색 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
