import { NextRequest, NextResponse } from "next/server";
import { crawlDiningCode } from "@/lib/agents/nodes/diningcode";
import { deduplicatePlaces } from "@/lib/agents/utils/dedup";
import { saveCrawledPlaces } from "@/lib/agents/utils/place-cache";
import { geocode } from "@/lib/geocode";
import { reverseGeocode } from "@/lib/reverse-geocode";
import type { Bounds } from "@/types/place";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bounds } = body as { bounds: Bounds };

    if (!bounds || !bounds.swLat || !bounds.neLat) {
      return NextResponse.json(
        { error: "bounds required" },
        { status: 400 }
      );
    }

    // 1. Get center of current bounds
    const centerLat = (bounds.swLat + bounds.neLat) / 2;
    const centerLng = (bounds.swLng + bounds.neLng) / 2;

    // 2. Reverse geocode to get area name
    const area = await reverseGeocode(centerLat, centerLng);
    const dong = area?.dong || "";
    const gu = area?.gu || "";
    const areaName = dong || gu || "현재 지역";

    // 3. Build search queries
    const queries: string[] = [];
    if (dong) queries.push(`${dong} 맛집`);
    if (gu && gu !== dong) queries.push(`${gu} 맛집`);
    if (dong) queries.push(`${dong} 카페`);
    // Ensure at least one query
    if (queries.length === 0) queries.push("서울 맛집");

    // 4. Crawl DiningCode in parallel (max 3 queries)
    const crawlResults = await Promise.all(
      queries.slice(0, 3).map((q) =>
        crawlDiningCode(q).catch((err) => {
          console.error(`Crawl failed for "${q}":`, err);
          return [];
        })
      )
    );

    const allRaw = crawlResults.flat();
    if (allRaw.length === 0) {
      return NextResponse.json({ count: 0, areaName });
    }

    // 5. Deduplicate
    const merged = deduplicatePlaces(allRaw);

    // 6. Geocode places missing coordinates
    const geocoded = await Promise.all(
      merged.map(async (place) => {
        if (place.lat && place.lng) return place;
        if (!place.name) return place;
        const searchQuery = place.address || `${areaName} ${place.name}`;
        const geo = await geocode(searchQuery);
        if (geo) {
          return {
            ...place,
            lat: geo.lat,
            lng: geo.lng,
            address: place.address || geo.address,
          };
        }
        return place;
      })
    );

    // 7. Filter to bounds
    const inBounds = geocoded.filter((p) => {
      if (!p.lat || !p.lng) return false;
      return (
        p.lat >= bounds.swLat &&
        p.lat <= bounds.neLat &&
        p.lng >= bounds.swLng &&
        p.lng <= bounds.neLng
      );
    });

    // 8. Save to DB
    if (inBounds.length > 0) {
      await saveCrawledPlaces(inBounds);
    }

    return NextResponse.json({ count: inBounds.length, areaName });
  } catch (error) {
    console.error("Crawl API error:", error);
    return NextResponse.json(
      { error: "크롤링 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
