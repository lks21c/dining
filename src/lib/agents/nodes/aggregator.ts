import { prisma } from "@/lib/prisma";
import { geocode } from "@/lib/geocode";
import { getRecommendations } from "@/lib/llm";
import type { Place } from "@/types/place";
import type { AgentState } from "../state";
import { deduplicatePlaces } from "../utils/dedup";
import { saveCrawledPlaces } from "../utils/place-cache";

export async function aggregator(
  state: AgentState
): Promise<Partial<AgentState>> {
  const { query, bounds, location, crawledPlaces, agentErrors } = state;

  if (agentErrors.length > 0) {
    console.warn("Agent errors during crawling:", agentErrors);
  }

  // 1. Deduplicate crawled places
  const merged = deduplicatePlaces(crawledPlaces);

  // 2. Geocode places missing coordinates
  const geocoded = await Promise.all(
    merged.map(async (place) => {
      if (place.lat && place.lng) return place;
      if (!place.name) return place;

      const searchQuery = place.address || `${state.searchTerms} ${place.name}`;
      const geo = await geocode(searchQuery);
      if (geo) {
        return { ...place, lat: geo.lat, lng: geo.lng, address: place.address || geo.address };
      }
      return place;
    })
  );

  // 3. Filter places within bounds
  const inBounds = bounds
    ? geocoded.filter((p) => {
        if (!p.lat || !p.lng) return false;
        return (
          p.lat >= bounds.swLat &&
          p.lat <= bounds.neLat &&
          p.lng >= bounds.swLng &&
          p.lng <= bounds.neLng
        );
      })
    : geocoded.filter((p) => p.lat && p.lng);

  // 4. Save to DB cache
  try {
    await saveCrawledPlaces(inBounds);
  } catch (error) {
    console.error("Failed to save crawled places:", error);
  }

  // 5. Load seed DB data (existing restaurants, cafes, parking)
  const boundsWhere = bounds
    ? {
        lat: { gte: bounds.swLat, lte: bounds.neLat },
        lng: { gte: bounds.swLng, lte: bounds.neLng },
      }
    : {};

  const [restaurants, cafes, parkingLots] = await Promise.all([
    prisma.restaurant.findMany({ where: boundsWhere }),
    prisma.cafe.findMany({ where: boundsWhere }),
    prisma.parkingLot.findMany({ where: boundsWhere }),
  ]);

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

  // 6. Convert crawled places to Place type (as restaurants)
  const crawledAsPlaces: Place[] = inBounds
    .filter((p) => p.lat && p.lng)
    .map((p) => ({
      id: `crawled_${p.name.replace(/\s+/g, "_").toLowerCase()}_${Math.random().toString(36).slice(2, 8)}`,
      name: p.name,
      description: p.snippet || p.description || `${p.sources.map((s) => s.source).join(", ")}에서 추천`,
      lat: p.lat!,
      lng: p.lng!,
      type: "restaurant" as const,
      category: p.category || "맛집",
      priceRange: "미정",
      atmosphere: "미정",
      goodFor: "미정",
      rating: p.sources[0]?.rating || 0,
      reviewCount: p.sources[0]?.reviewCount || 0,
      parkingAvailable: false,
      nearbyParking: null,
    }));

  // 7. Merge: seed data + crawled data (avoid name duplicates)
  const seedNames = new Set(seedPlaces.map((p) => p.name.toLowerCase()));
  const uniqueCrawled = crawledAsPlaces.filter(
    (p) => !seedNames.has(p.name.toLowerCase())
  );
  const allPlaces = [...seedPlaces, ...uniqueCrawled];

  if (allPlaces.length === 0) {
    return {
      finalResult: {
        persona: "",
        recommendations: [],
        routeSummary: "이 지역에 등록된 장소가 없습니다.",
        places: [],
        center: location || undefined,
      },
    };
  }

  // 8. Get LLM recommendations
  const anchor = location || undefined;
  const llmResult = await getRecommendations(query, allPlaces, anchor);

  const placeMap = new Map(allPlaces.map((p) => [p.id, p]));
  const recommendedPlaces = llmResult.recommendations
    .map((rec) => placeMap.get(rec.id))
    .filter((p): p is Place => !!p);

  return {
    finalResult: {
      ...llmResult,
      places: recommendedPlaces,
      center: location || undefined,
    },
  };
}
