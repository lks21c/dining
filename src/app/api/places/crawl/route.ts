import { NextRequest } from "next/server";
import { crawlDiningCode } from "@/lib/agents/nodes/diningcode";
import { deduplicatePlaces } from "@/lib/agents/utils/dedup";
import { saveCrawledPlaces } from "@/lib/agents/utils/place-cache";
import { classifyPlaces } from "@/lib/classify";
import { geocode } from "@/lib/geocode";
import { prisma } from "@/lib/prisma";
import { getOpenRouter, MODEL, extractJson } from "@/lib/openrouter";
import type { Bounds } from "@/types/place";

/* ---------- SSE helper ---------- */

const encoder = new TextEncoder();

function send(controller: ReadableStreamDefaultController, data: Record<string, unknown>) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
}

/* ---------- Gemini 주차장 조회 ---------- */

interface ParkingData {
  name: string;
  address: string;
  lat: number;
  lng: number;
  capacity: number;
  hourlyRate: number;
  operatingHours: string;
  type: string;
}

async function fetchParkingByKeyword(keyword: string): Promise<ParkingData[]> {
  try {
    const completion = await getOpenRouter().chat.completions.create({
      model: MODEL,
      temperature: 0,
      max_tokens: 8000,
      messages: [
        {
          role: "system",
          content: `당신은 서울시 공영주차장 정보를 정확하게 제공하는 전문가입니다.
반드시 JSON 배열로만 응답하세요. 다른 텍스트 없이 JSON만 응답하세요.

[
  {
    "name": "주차장 이름",
    "address": "서울특별시 OO구 OO로 123",
    "lat": 37.xxxx,
    "lng": 126.xxxx 또는 127.xxxx,
    "capacity": 주차면수(숫자, 모르면 50),
    "hourlyRate": 시간당요금(원, 숫자, 모르면 1000),
    "operatingHours": "HH:MM~HH:MM",
    "type": "공영" 또는 "노상" 또는 "노외"
  }
]

규칙:
- 해당 지역의 공영주차장, 공공주차장을 최대한 많이 알려주세요
- 구청 주차장, 공원 주차장, 주민센터 주차장, 체육관 주차장, 역 근처 공영주차장 등 포함
- address는 도로명주소 "서울특별시 OO구 OO로 123" 형식
- lat, lng는 실제 위치의 정확한 좌표 (소수점 4자리)
- 서울 위도 범위: 37.45~37.70, 경도 범위: 126.76~127.18
- 반경 1km 이내에 있는 주차장을 우선적으로 알려주세요`,
        },
        {
          role: "user",
          content: `"${keyword}" 근방 1km 이내에 있는 공영주차장 목록을 모두 알려주세요.`,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return [];

    const parsed: ParkingData[] = JSON.parse(extractJson(content));
    // Validate coordinates
    return parsed.filter(
      (p) =>
        p.name &&
        p.lat >= 37.45 &&
        p.lat <= 37.7 &&
        p.lng >= 126.76 &&
        p.lng <= 127.18
    );
  } catch (err) {
    console.error("[crawl] parking LLM error:", err);
    return [];
  }
}

async function saveParkingLots(lots: ParkingData[]): Promise<number> {
  let added = 0;
  for (const p of lots) {
    const existing = await prisma.parkingLot.findFirst({
      where: { name: p.name.trim() },
    });
    if (existing) continue;

    await prisma.parkingLot.create({
      data: {
        name: p.name.trim(),
        type: p.type || "공영",
        address: p.address || null,
        lat: p.lat,
        lng: p.lng,
        capacity: p.capacity || 50,
        hourlyRate: p.hourlyRate || 1000,
        description: p.address || p.name,
        operatingHours: p.operatingHours || "00:00~24:00",
      },
    });
    added++;
  }
  return added;
}

/* ---------- Route handler ---------- */

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { keyword, bounds } = body as { keyword: string; bounds?: Bounds };

  if (!keyword || !keyword.trim()) {
    return new Response(JSON.stringify({ error: "keyword required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const trimmed = keyword.trim();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        console.log("[crawl] keyword:", trimmed);
        send(controller, { step: "searching", message: "맛집 검색 중..." });

        // 1. DiningCode + Parking 병렬
        const [rawPlaces, parkingLots] = await Promise.all([
          crawlDiningCode(trimmed).catch((err) => {
            console.error("[crawl] diningcode error:", err);
            return [];
          }),
          fetchParkingByKeyword(trimmed).catch((err) => {
            console.error("[crawl] parking error:", err);
            return [];
          }),
        ]);

        console.log("[crawl] diningcode:", rawPlaces.length, "parking:", parkingLots.length);
        send(controller, {
          step: "fetched",
          message: `맛집 ${rawPlaces.length}개, 주차장 ${parkingLots.length}개 발견`,
          places: rawPlaces.length,
          parking: parkingLots.length,
        });

        // 2. 주차장 DB 저장 (병렬)
        const parkingPromise =
          parkingLots.length > 0
            ? saveParkingLots(parkingLots)
            : Promise.resolve(0);

        // 3. 맛집/카페 처리
        let placeCount = 0;
        if (rawPlaces.length > 0) {
          const merged = deduplicatePlaces(rawPlaces);

          // geocoding with progress
          const needsGeocode = merged.filter((p) => !(p.lat && p.lng) && p.name);
          const total = needsGeocode.length;
          let progress = 0;

          const geocoded = await Promise.all(
            merged.map(async (place) => {
              if (place.lat && place.lng) return place;
              if (!place.name) return place;
              const searchQuery = place.address || `${trimmed} ${place.name}`;
              const geo = await geocode(searchQuery);
              progress++;
              if (total > 0) {
                send(controller, {
                  step: "geocoding",
                  message: "위치 확인 중...",
                  progress,
                  total,
                });
              }
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

          let results = geocoded.filter((p) => p.lat && p.lng);

          if (bounds && bounds.swLat && bounds.neLat) {
            const inBounds = results.filter(
              (p) =>
                p.lat! >= bounds.swLat &&
                p.lat! <= bounds.neLat &&
                p.lng! >= bounds.swLng &&
                p.lng! <= bounds.neLng
            );
            if (inBounds.length > 0) {
              results = inBounds;
            }
          }

          // classify places via Gemini Flash
          send(controller, { step: "classifying", message: "카테고리 분류 중..." });
          const typeMap = await classifyPlaces(results);

          // Build save-ready objects with placeType explicitly included
          const placesWithType = results.map((r) => ({
            ...r,
            placeType: typeMap[r.name] || "restaurant",
          }));

          send(controller, { step: "saving", message: "저장 중..." });

          if (placesWithType.length > 0) {
            await saveCrawledPlaces(placesWithType);
          }
          placeCount = results.length;
        } else {
          send(controller, { step: "saving", message: "저장 중..." });
        }

        const parkingAdded = await parkingPromise;
        console.log("[crawl] saved places:", placeCount, "parking added:", parkingAdded);

        send(controller, {
          step: "done",
          count: placeCount,
          parkingAdded,
          keyword: trimmed,
        });
      } catch (error) {
        console.error("Crawl API error:", error);
        send(controller, { step: "error", message: "크롤링 중 오류가 발생했습니다." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
