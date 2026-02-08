import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRecommendations } from "@/lib/llm";
import type { Place } from "@/types/place";

export async function POST(req: NextRequest) {
  const { query, bounds } = await req.json();

  if (!query || !bounds) {
    return NextResponse.json(
      { error: "query and bounds are required" },
      { status: 400 }
    );
  }

  const boundsWhere = {
    lat: { gte: bounds.swLat, lte: bounds.neLat },
    lng: { gte: bounds.swLng, lte: bounds.neLng },
  };

  const [restaurants, cafes, parkingLots] = await Promise.all([
    prisma.restaurant.findMany({ where: boundsWhere }),
    prisma.cafe.findMany({ where: boundsWhere }),
    prisma.parkingLot.findMany({ where: boundsWhere }),
  ]);

  const allPlaces: Place[] = [
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
      capacity: p.capacity,
      hourlyRate: p.hourlyRate,
      operatingHours: p.operatingHours,
    })),
  ];

  if (allPlaces.length === 0) {
    return NextResponse.json({
      persona: "",
      recommendations: [],
      routeSummary: "이 지역에 등록된 장소가 없습니다.",
      places: [],
    });
  }

  const llmResult = await getRecommendations(query, allPlaces);

  // Attach full place data to recommendations
  const placeMap = new Map(allPlaces.map((p) => [p.id, p]));
  const places = llmResult.recommendations
    .map((rec) => placeMap.get(rec.id))
    .filter((p): p is Place => !!p);

  return NextResponse.json({
    ...llmResult,
    places,
  });
}
