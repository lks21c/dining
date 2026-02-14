import type { Place } from "@/types/place";

interface SeedRestaurant {
  id: string;
  name: string;
  description: string;
  lat: number;
  lng: number;
  category: string;
  priceRange: string;
  atmosphere: string;
  goodFor: string;
  rating: number;
  reviewCount: number;
  parkingAvailable: boolean;
  nearbyParking: string | null;
  tags?: string | null;
}

interface SeedCafe {
  id: string;
  name: string;
  description: string;
  lat: number;
  lng: number;
  specialty: string;
  priceRange: string;
  atmosphere: string;
  goodFor: string;
  rating: number;
  reviewCount: number;
  parkingAvailable: boolean;
  nearbyParking: string | null;
  tags?: string | null;
}

interface SeedParkingLot {
  id: string;
  name: string;
  description: string;
  lat: number;
  lng: number;
  type: string;
  address?: string | null;
  capacity: number;
  hourlyRate: number;
  baseTime?: number | null;
  baseRate?: number | null;
  extraTime?: number | null;
  extraRate?: number | null;
  freeNote?: string | null;
  operatingHours: string;
}

interface CrawledPlaceWithSources {
  id: string;
  name: string;
  description: string | null;
  lat: number | null;
  lng: number | null;
  category: string | null;
  tags: string | null;
  priceRange: string | null;
  atmosphere: string | null;
  goodFor: string | null;
  placeType: string | null;
  address: string | null;
  sources: {
    source: string;
    snippet: string | null;
    rating: number | null;
    reviewCount: number | null;
    metadata: string | null;
  }[];
}

export function mapSeedPlaces(
  restaurants: SeedRestaurant[],
  cafes: SeedCafe[],
  parkingLots: SeedParkingLot[]
): Place[] {
  return [
    ...restaurants.map((r) => ({
      ...r,
      type: "restaurant" as const,
      tags: r.tags ?? undefined,
    })),
    ...cafes.map((c) => ({
      ...c,
      type: "cafe" as const,
      tags: c.tags ?? undefined,
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
}

export function mapCrawledToPlaces(
  crawledPlaces: CrawledPlaceWithSources[],
  llmTypeMap: Record<string, string> = {}
): Place[] {
  const validCrawled = crawledPlaces.filter(
    (cp) => cp.lat != null && cp.lng != null
  );

  return validCrawled.map((cp) => {
    const pType = cp.placeType || llmTypeMap[cp.name] || "restaurant";
    const base = {
      id: cp.id,
      name: cp.name,
      description:
        cp.description || cp.sources[0]?.snippet || "다이닝코드 크롤링",
      lat: cp.lat!,
      lng: cp.lng!,
      priceRange: cp.priceRange || "미정",
      atmosphere: cp.atmosphere || "미정",
      goodFor: cp.goodFor || "미정",
      rating: cp.sources[0]?.rating || 0,
      reviewCount: cp.sources[0]?.reviewCount || 0,
      parkingAvailable: false,
      nearbyParking: null,
      tags: cp.tags ?? undefined,
    };

    switch (pType) {
      case "cafe":
        return {
          ...base,
          type: "cafe" as const,
          specialty: cp.category || "카페",
        };
      case "bar":
        return {
          ...base,
          type: "bar" as const,
          category: cp.category || "술집",
        };
      case "bakery":
        return {
          ...base,
          type: "bakery" as const,
          specialty: cp.category || "빵집",
        };
      default:
        return {
          ...base,
          type: "restaurant" as const,
          category: cp.category || "맛집",
        };
    }
  });
}

export function rankByDiningCode(
  crawledAsPlaces: Place[],
  crawledPlaces: CrawledPlaceWithSources[]
): void {
  const validCrawled = crawledPlaces.filter(
    (cp) => cp.lat != null && cp.lng != null
  );

  const withScores = crawledAsPlaces
    .map((p, i) => {
      const dcSource = validCrawled[i]?.sources.find(
        (s) => s.source === "diningcode"
      );
      const meta = dcSource?.metadata;
      let score: number | null = null;
      if (meta) {
        try {
          score = JSON.parse(meta).score ?? null;
        } catch {
          /* ignore */
        }
      }
      return { place: p, score };
    })
    .filter((x): x is { place: Place; score: number } => x.score != null)
    .sort((a, b) => b.score - a.score);

  withScores.forEach((x, i) => {
    if (x.place.type !== "parking") {
      x.place.diningcodeRank = i + 1;
    }
  });
}

export function deduplicatePlaces(
  seedPlaces: Place[],
  crawledAsPlaces: Place[]
): Place[] {
  const seedNames = new Set(seedPlaces.map((p) => p.name.toLowerCase()));
  const uniqueCrawled = crawledAsPlaces.filter(
    (p) => !seedNames.has(p.name.toLowerCase())
  );
  return [...seedPlaces, ...uniqueCrawled];
}

/**
 * Extract region (구/시) from Korean address string.
 * e.g. "서울특별시 강남구 ..." → "강남구"
 *      "대구광역시 서구 ..." → "대구 서구"
 *      "경상북도 ..." → "경상북도"
 */
export function extractRegion(address: string | null | undefined): string {
  if (!address) return "기타";

  // Match metropolitan city pattern: 서울특별시/부산광역시/etc + 구/군
  const metroMatch = address.match(
    /^(서울특별시|서울)\s+(\S+[구군])/
  );
  if (metroMatch) return metroMatch[2];

  // Match other metro cities: 대구광역시 서구, 부산광역시 해운대구, etc
  const otherMetroMatch = address.match(
    /^(대구|부산|인천|광주|대전|울산)(광역시)?\s+(\S+[구군])/
  );
  if (otherMetroMatch)
    return `${otherMetroMatch[1]} ${otherMetroMatch[3]}`;

  // Match province + city: 경기도 수원시 등
  const provinceMatch = address.match(
    /^(경기도|충청[남북]도|전라[남북]도|경상[남북]도|강원도|제주특별자치도|세종특별자치시)\s*(\S+[시군구])?/
  );
  if (provinceMatch) {
    return provinceMatch[2]
      ? `${provinceMatch[1]} ${provinceMatch[2]}`
      : provinceMatch[1];
  }

  // Fallback: try to find any 구/군/시
  const guMatch = address.match(/(\S+[구군시])/);
  if (guMatch) return guMatch[1];

  return "기타";
}
