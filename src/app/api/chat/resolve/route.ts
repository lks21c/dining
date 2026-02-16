import { NextRequest, NextResponse } from "next/server";
import { openrouter, FLASH_MODEL, extractJson } from "@/lib/openrouter";
import { geocode, searchPlace } from "@/lib/geocode";
import { boundsFromCenter } from "@/lib/bounds";
import { getRecommendations } from "@/lib/llm";
import { prisma } from "@/lib/prisma";
import { crawlDiningCode } from "@/lib/agents/nodes/diningcode";
import { deduplicatePlaces } from "@/lib/agents/utils/dedup";
import { saveCrawledPlaces } from "@/lib/agents/utils/place-cache";
import { classifyPlaces } from "@/lib/classify";
import { normalizeName } from "@/lib/normalize";
import type { Place, Course } from "@/types/place";

const RADIUS_KM = 1.5;

interface ExtractedPlaces {
  region: string;
  places: string[];
  courses?: string[][];
}

/**
 * Step 1: Use Gemini Flash to extract place names and region from AI response.
 * Returns courses (multiple route options) when the AI suggests alternatives.
 */
async function extractPlacesFromResponse(
  aiResponse: string
): Promise<ExtractedPlaces> {
  const completion = await openrouter.chat.completions.create({
    model: FLASH_MODEL,
    temperature: 0,
    max_tokens: 2000,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `AI 응답에서 추천된 장소명과 지역, 그리고 추천 코스를 JSON으로 추출하세요.

규칙:
- 음식점, 카페, 디저트 가게, 술집 등의 가게 이름만 추출
- 체인점 이름(스타벅스, 역전할머니맥주 등)도 포함
- 지역명은 응답에서 언급된 가장 구체적인 지역 (예: "대구 종로", "서울 이태원")
- 같은 가게의 다른 지점(예: "사운즈커피 프리미어", "사운즈커피 삼덕점")은 먼저 언급된 것 하나만 포함
- "추천 코스"나 "동선" 등 방문 순서가 제시되어 있으면 반드시 그 순서대로 courses 배열을 구성
- "A이나 B", "A 또는 B", "A 혹은 B"처럼 대안이 있으면 각각 별도 코스로 분리
  예: "로산가옥 → 사운즈커피 → 윤달이나 온달포장" → courses: [["로산가옥","사운즈커피","윤달"], ["로산가옥","사운즈커피","온달포장"]]
- 장소들이 번호 매기기(1. 2. 3.)나 별도 항목으로 독립적으로 추천된 경우(각각이 하나의 선택지), 각 장소를 별도 코스로 분리
  예: "1. 블랙로드 2. 사운더 3. FF커피" → courses: [["블랙로드"], ["사운더"], ["FF커피"]]
  예: "카페 추천: 블랙로드, 사운더, FF커피" (각각 독립 추천) → courses: [["블랙로드"], ["사운더"], ["FF커피"]]
- 단, "A → B → C" 처럼 방문 순서가 있는 코스는 하나의 코스로 유지
  예: "갓잇 → 해룡 → 블랙로드" → courses: [["갓잇","해룡","블랙로드"]]
- places에는 모든 코스에 등장하는 고유 장소명을 중복 없이 나열

반드시 JSON만 응답:
{"region": "지역명", "places": ["장소1", "장소2", ...], "courses": [["장소1","장소2"], ["장소1","장소3"]]}

courses는 항상 포함하세요. 순서가 있는 동선이면 하나의 코스로, 독립 추천이면 각각 별도 코스로.`,
      },
      { role: "user", content: aiResponse },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("No response from LLM");

  console.log("[resolve] LLM extraction raw:", content.slice(0, 500));

  const parsed = JSON.parse(extractJson(content));
  console.log("[resolve] Extracted:", JSON.stringify(parsed));
  return parsed;
}

/**
 * Build Place[] from DB records within bounds (same logic as search route).
 */
async function queryPlacesInBounds(bounds: {
  swLat: number;
  neLat: number;
  swLng: number;
  neLng: number;
}): Promise<Place[]> {
  const boundsWhere = {
    lat: { gte: bounds.swLat, lte: bounds.neLat },
    lng: { gte: bounds.swLng, lte: bounds.neLng },
  };

  const [restaurants, cafes, crawledRecords] = await Promise.all([
    prisma.restaurant.findMany({ where: boundsWhere }),
    prisma.cafe.findMany({ where: boundsWhere }),
    prisma.crawledPlace.findMany({
      where: {
        lat: { gte: bounds.swLat, lte: bounds.neLat },
        lng: { gte: bounds.swLng, lte: bounds.neLng },
      },
      include: { sources: true },
    }),
  ]);

  const seedPlaces: Place[] = [
    ...restaurants.map((r) => ({ ...r, type: "restaurant" as const })),
    ...cafes.map((c) => ({ ...c, type: "cafe" as const })),
  ];

  const seedNames = new Set(seedPlaces.map((p) => p.name.toLowerCase()));
  const validCrawled = crawledRecords.filter(
    (cp) => cp.lat && cp.lng && !seedNames.has(cp.name.toLowerCase())
  );

  const crawledAsPlaces: Place[] = validCrawled.map((cp) => ({
    id: cp.id,
    name: cp.name,
    description:
      cp.description ||
      `${cp.sources.map((s) => s.source).join(", ")}에서 추천`,
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

  return [...seedPlaces, ...crawledAsPlaces];
}

/**
 * Try to resolve a place name to coordinates via:
 * 1. Naver Place Search API (name-based search)
 * 2. Geocode with region prefix (address-based)
 * 3. Center fallback with offset (last resort)
 */
async function resolvePlace(
  name: string,
  region: string,
  center: { lat: number; lng: number },
  offsetIndex: number
): Promise<{ lat: number; lng: number; method: string }> {
  // 1. Naver Place Search (can find stores by name)
  const placeResult = await searchPlace(`${region} ${name}`);
  if (placeResult) {
    return { lat: placeResult.lat, lng: placeResult.lng, method: "place-search" };
  }

  // 2. Address geocoding
  const geoResult = await geocode(`${region} ${name}`);
  if (geoResult) {
    return { lat: geoResult.lat, lng: geoResult.lng, method: "geocode" };
  }

  // 3. Spread around center with small offset (~100m apart)
  const angle = (offsetIndex * 2 * Math.PI) / 6; // spread in circle
  const offsetDeg = 0.001; // ~111m
  return {
    lat: center.lat + offsetDeg * Math.cos(angle),
    lng: center.lng + offsetDeg * Math.sin(angle),
    method: "center-offset",
  };
}

/**
 * Resolve a course name list to Place objects, preserving order.
 */
function resolveNamesToPLaces(
  names: string[],
  placePool: Place[]
): Place[] {
  return names
    .map((name) => {
      const en = normalizeName(name);
      return placePool.find((dp) => {
        const dn = normalizeName(dp.name);
        return dn.includes(en) || en.includes(dn);
      });
    })
    .filter((p): p is Place => !!p);
}

/**
 * Build courses from extracted course structure or fall back to single course.
 */
function buildCourses(
  matchedPlaces: Place[],
  extractedCourses?: string[][],
): Course[] {
  if (matchedPlaces.length === 0) return [];

  // If LLM extracted multiple courses, build each one
  if (extractedCourses && extractedCourses.length > 0) {
    return extractedCourses.map((courseNames, ci) => {
      const coursePlaces = resolveNamesToPLaces(courseNames, matchedPlaces);
      return {
        courseNumber: ci + 1,
        title: coursePlaces.map((p) => p.name).join(" + "),
        stops: coursePlaces.map((p, i) => ({
          order: i + 1,
          id: p.id,
          type: p.type,
          reason: "채팅 AI 추천",
        })),
        routeSummary: coursePlaces.map((p) => p.name).join(" → "),
      };
    }).filter((c) => c.stops.length > 0);
  }

  // Fallback: single course preserving input order
  return [{
    courseNumber: 1,
    title: matchedPlaces.map((p) => p.name).join(" + "),
    stops: matchedPlaces.map((p, i) => ({
      order: i + 1,
      id: p.id,
      type: p.type,
      reason: "채팅 AI 추천",
    })),
    routeSummary: matchedPlaces.map((p) => p.name).join(" → "),
  }];
}

/**
 * POST /api/chat/resolve
 *
 * Input: { userQuery: string, aiResponse: string }
 *    OR: { region: string, places: string[] }   ← direct (skip LLM extraction)
 * Output: SearchResult (same shape as /api/places/search)
 */
export async function POST(req: NextRequest) {
  try {
    let body: { userQuery?: string; aiResponse?: string; region?: string; places?: string[] };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "잘못된 요청 형식입니다." },
        { status: 400 }
      );
    }

    const { userQuery, aiResponse } = body;

    let region: string;
    let placeNames: string[];
    let extractedCourses: string[][] | undefined;

    if (body.region && body.places?.length) {
      // Direct region + places provided (e.g. from shared URL) — skip LLM extraction
      region = body.region;
      placeNames = body.places;
    } else if (aiResponse) {
      // Extract places and region from AI response via LLM
      const extracted = await extractPlacesFromResponse(aiResponse);
      region = extracted.region;
      placeNames = extracted.places;
      extractedCourses = extracted.courses;
    } else {
      return NextResponse.json(
        { error: "aiResponse or region+places is required" },
        { status: 400 }
      );
    }

    if (!region) {
      return NextResponse.json(
        { error: "지역을 파악할 수 없습니다." },
        { status: 400 }
      );
    }

    // Step 2: Geocode region → center + bounds
    const geo = await geocode(region);
    if (!geo) {
      return NextResponse.json(
        { error: `"${region}" 위치를 찾을 수 없습니다.` },
        { status: 400 }
      );
    }

    const center = { lat: geo.lat, lng: geo.lng, name: region };
    const bounds = boundsFromCenter(geo.lat, geo.lng, RADIUS_KM);

    // Step 3: Query DB for places in bounds
    let allPlaces = await queryPlacesInBounds(bounds);

    // Step 4: Check which extracted places are matched in DB
    const normalizedExtracted = placeNames.map((n) => normalizeName(n));

    function findMatched(dbPlaces: Place[]): Place[] {
      return dbPlaces.filter((dp) => {
        const dn = normalizeName(dp.name);
        return normalizedExtracted.some(
          (en) => dn.includes(en) || en.includes(dn)
        );
      });
    }

    function findUnmatchedNames(): string[] {
      return placeNames.filter((name) => {
        const en = normalizeName(name);
        return !allPlaces.some((dp) => {
          const dn = normalizeName(dp.name);
          return dn.includes(en) || en.includes(dn);
        });
      });
    }

    let unmatchedNames = findUnmatchedNames();

    // Step 5: Fire-and-forget DiningCode crawl for unmatched places (don't block response)
    if (unmatchedNames.length > 0) {
      crawlDiningCode(region)
        .then(async (rawPlaces) => {
          if (rawPlaces.length === 0) return;
          const merged = deduplicatePlaces(rawPlaces);
          for (const place of merged) {
            if (!place.lat || !place.lng) {
              const addr = place.address || `${region} ${place.name}`;
              const g = await geocode(addr);
              if (g) { place.lat = g.lat; place.lng = g.lng; }
            }
          }
          const typeMap = await classifyPlaces(
            merged.map((p) => ({ name: p.name, category: p.category, tags: p.tags, description: p.description }))
          );
          const placesForSave = merged.map((p) => ({ ...p, placeType: typeMap[p.name] || undefined }));
          await saveCrawledPlaces(placesForSave);
          console.log(`[resolve] Background crawl saved ${placesForSave.length} places for "${region}"`);
        })
        .catch((err) => console.error("[resolve] Background crawl error:", err));
    }

    // Step 5.5: For still-unmatched places, resolve coordinates via place search
    unmatchedNames = findUnmatchedNames();
    if (unmatchedNames.length > 0) {
      console.log(
        `[resolve] Still unmatched after crawl (${unmatchedNames.length}): ${unmatchedNames.join(", ")}`
      );
      for (let i = 0; i < unmatchedNames.length; i++) {
        const name = unmatchedNames[i];
        const resolved = await resolvePlace(name, region, center, i);
        console.log(
          `[resolve] Resolved "${name}" via ${resolved.method}: ${resolved.lat},${resolved.lng}`
        );
        // Guess type from name (카페/커피/스타벅스/맨션 etc. → cafe, else restaurant)
        const isCafe = /카페|커피|coffee|로스터|베이커리|bakery|디저트|스타벅스|starbucks|투썸|이디야|할리스|블루보틀|맨션|mansion|하우스|house|브런치/i.test(name);
        const place: Place = isCafe
          ? {
              id: `resolved-${name}`,
              name,
              description: `${region} ${name}`,
              lat: resolved.lat,
              lng: resolved.lng,
              type: "cafe" as const,
              specialty: "미정",
              priceRange: "미정",
              atmosphere: "미정",
              goodFor: "미정",
              rating: 0,
              reviewCount: 0,
              parkingAvailable: false,
              nearbyParking: null,
            }
          : {
              id: `resolved-${name}`,
              name,
              description: `${region} ${name}`,
              lat: resolved.lat,
              lng: resolved.lng,
              type: "restaurant" as const,
              category: "맛집",
              priceRange: "미정",
              atmosphere: "미정",
              goodFor: "미정",
              rating: 0,
              reviewCount: 0,
              parkingAvailable: false,
              nearbyParking: null,
            };
        allPlaces.push(place);
      }
    }

    // Step 6: Build result — use matched places only (chat AI's picks), preserving AI recommendation order
    const matchedUnordered = findMatched(allPlaces);
    const matchedPlaces = placeNames
      .map((name) => {
        const en = normalizeName(name);
        return matchedUnordered.find((dp) => {
          const dn = normalizeName(dp.name);
          return dn.includes(en) || en.includes(dn);
        });
      })
      .filter((p): p is Place => !!p);
    console.log(
      `[resolve] Final matched: ${matchedPlaces.length}/${allPlaces.length} — ${matchedPlaces.map((p) => p.name).join(", ")}`
    );

    if (matchedPlaces.length === 0) {
      // Fallback: call getRecommendations with all DB places
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

      const queryForLLM = userQuery || `${region} 맛집 추천`;
      const llmResult = await getRecommendations(queryForLLM, allPlaces, center);
      const refIds = new Set<string>();
      for (const c of llmResult.courses) for (const s of c.stops) refIds.add(s.id);
      const placeMap = new Map(allPlaces.map((p) => [p.id, p]));
      const refPlaces = [...refIds].map((id) => placeMap.get(id)).filter((p): p is Place => !!p);

      return NextResponse.json({
        summary: llmResult.summary,
        persona: llmResult.persona,
        courses: llmResult.courses,
        recommendations: llmResult.courses[0]?.stops || [],
        routeSummary: llmResult.courses[0]?.routeSummary || "",
        places: refPlaces,
        center,
        ...(llmResult.warning && { warning: llmResult.warning }),
      });
    }

    // Happy path: we have matched places — build courses directly without calling LLM again
    const courses = buildCourses(matchedPlaces, extractedCourses);

    // Build a summary from the original AI response (truncated for the map view)
    const summaryLines: string[] = [];
    summaryLines.push(
      `${region} 일대에서 채팅 AI가 추천한 장소들입니다.`
    );
    for (const p of matchedPlaces) {
      summaryLines.push(`\n**${p.name}**\n${p.description || ""}`);
    }
    summaryLines.push(
      `\n**팁**: 모든 추천 장소는 ${region} 인근에 위치해 있습니다.`
    );

    return NextResponse.json({
      summary: summaryLines.join("\n"),
      persona: userQuery || `${region} 맛집 추천`,
      courses,
      recommendations: courses[0]?.stops || [],
      routeSummary: courses[0]?.routeSummary || "",
      places: matchedPlaces,
      center,
    });
  } catch (error) {
    console.error("Resolve error:", error);
    return NextResponse.json(
      { error: "장소 해석 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
