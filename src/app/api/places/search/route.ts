import { NextRequest, NextResponse } from "next/server";
import { extractLocation } from "@/lib/llm";
import { geocode } from "@/lib/geocode";
import { searchGraph } from "@/lib/agents/graph";

const RADIUS_KM = 1.5;

function boundsFromCenter(lat: number, lng: number, radiusKm: number) {
  const latDelta = radiusKm / 111.32;
  const lngDelta = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  return {
    swLat: lat - latDelta,
    neLat: lat + latDelta,
    swLng: lng - lngDelta,
    neLng: lng + lngDelta,
  };
}

export async function POST(req: NextRequest) {
  const { query, bounds } = await req.json();

  if (!query) {
    return NextResponse.json(
      { error: "query is required" },
      { status: 400 }
    );
  }

  // 1. Extract location from query
  const locationName = await extractLocation(query);

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

  // 4. Invoke LangGraph multi-agent search
  try {
    const result = await searchGraph.invoke({
      query,
      searchTerms: "",
      location: center || null,
      bounds: searchBounds,
      crawledPlaces: [],
      agentErrors: [],
      finalResult: null,
    });

    if (result.finalResult) {
      return NextResponse.json(result.finalResult);
    }

    return NextResponse.json({
      persona: "",
      recommendations: [],
      routeSummary: "검색 결과가 없습니다.",
      places: [],
      center,
    });
  } catch (error) {
    console.error("Search graph error:", error);
    return NextResponse.json(
      { error: "검색 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
