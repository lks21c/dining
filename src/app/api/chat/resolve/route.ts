import { NextRequest, NextResponse } from "next/server";
import { getOpenRouter, FLASH_MODEL, extractJson } from "@/lib/openrouter";
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

/**
 * Token-based name matching: returns true if all tokens of one name
 * appear in the other. Checks both directions. Handles cases like:
 * - "용산구청 주차장" ↔ "용산구청 부설주차장"
 * - "라이너스 바베큐" ↔ "라이너스바베큐 이태원"
 */
function tokenMatch(a: string, b: string): boolean {
  // Substring match first (fast path)
  if (a.includes(b) || b.includes(a)) return true;
  // Token-based: check both directions
  const tokensA = a.split(/\s+/);
  const tokensB = b.split(/\s+/);
  const aInB = tokensA.length >= 2 && tokensA.every((t) => b.includes(t));
  const bInA = tokensB.length >= 2 && tokensB.every((t) => a.includes(t));
  return aInB || bInA;
}

interface ExtractedPlace {
  name: string;
  type: "parking" | "restaurant" | "cafe" | "bar" | "bakery" | "unknown";
}

interface ExtractedPlaces {
  region: string;
  places: ExtractedPlace[];
  courses?: ExtractedPlace[][];
}

/**
 * Step 1: Use Gemini Flash to extract place names and region from AI response.
 * Returns courses (multiple route options) when the AI suggests alternatives.
 */
async function extractPlacesFromResponse(
  aiResponse: string
): Promise<ExtractedPlaces> {
  const completion = await getOpenRouter().chat.completions.create({
    model: FLASH_MODEL,
    temperature: 0,
    max_tokens: 2000,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `AI 응답에서 추천된 장소명과 지역, 그리고 추천 코스를 JSON으로 추출하세요.

각 장소는 { "name": "장소명", "type": "타입" } 형태로 추출합니다.

type 분류 규칙:
- "parking": 주차장, 주차 관련 장소 (문맥에서 "주차", "차대고", "주차장" 등이 언급되면 parking)
- "restaurant": 음식점, 식당, 맛집
- "cafe": 카페, 커피, 디저트, 베이커리
- "bar": 술집, 바, 펍, 이자카야
- "bakery": 빵집, 제과점 (카페와 겸하면 "cafe")
- "unknown": 분류 불가

장소 추출 규칙:
- 음식점, 카페, 디저트 가게, 술집, 주차장 등 코스에 포함된 모든 장소를 추출
- 체인점 이름(스타벅스, 역전할머니맥주 등)도 포함
- 지역명은 응답에서 언급된 가장 구체적인 지역 (예: "대구 종로", "서울 이태원")
- 같은 가게의 다른 지점(예: "사운즈커피 프리미어", "사운즈커피 삼덕점")은 먼저 언급된 것 하나만 포함

코스 구성 규칙:
- "추천 코스"나 "동선" 등 방문 순서가 제시되어 있으면 반드시 그 순서대로 courses 배열을 구성
- "A이나 B", "A 또는 B", "A 혹은 B"처럼 대안이 있으면 각각 별도 코스로 분리
- 장소들이 번호 매기기(1. 2. 3.)나 별도 항목으로 독립적으로 추천된 경우, 각 장소를 별도 코스로 분리
- 단, "A → B → C" 처럼 방문 순서가 있는 코스는 하나의 코스로 유지
- places에는 모든 코스에 등장하는 고유 장소를 중복 없이 나열

반드시 JSON만 응답:
{"region": "지역명", "places": [{"name": "장소1", "type": "restaurant"}, ...], "courses": [[{"name": "장소1", "type": "parking"}, {"name": "장소2", "type": "restaurant"}]]}

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

  const [restaurants, cafes, parkingLots, crawledRecords] = await Promise.all([
    prisma.restaurant.findMany({ where: boundsWhere }),
    prisma.cafe.findMany({ where: boundsWhere }),
    prisma.parkingLot.findMany({ where: boundsWhere }),
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
): Promise<{ lat: number; lng: number; method: string } | null> {
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

  // No fallback — return null if we can't find real coordinates
  return null;
}

/**
 * Resolve a course name list to Place objects, preserving order.
 */
function resolveNamesToPLaces(
  extracted: ExtractedPlace[],
  placePool: Place[]
): Place[] {
  return extracted
    .map((ep) => {
      const en = normalizeName(ep.name);
      return placePool.find((dp) => tokenMatch(normalizeName(dp.name), en));
    })
    .filter((p): p is Place => !!p);
}

/**
 * Build courses from extracted course structure or fall back to single course.
 */
function buildCourses(
  matchedPlaces: Place[],
  extractedCourses?: ExtractedPlace[][],
): Course[] {
  if (matchedPlaces.length === 0) return [];

  // If LLM extracted multiple courses, build each one
  if (extractedCourses && extractedCourses.length > 0) {
    return extractedCourses.map((courseItems, ci) => {
      const coursePlaces = resolveNamesToPLaces(courseItems, matchedPlaces);
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
    let extractedPlaces: ExtractedPlace[];
    let extractedCourses: ExtractedPlace[][] | undefined;

    if (body.region && body.places?.length) {
      // Direct region + places provided (e.g. from shared URL) — skip LLM extraction
      region = body.region;
      extractedPlaces = body.places.map((name) => ({ name, type: "unknown" as const }));
    } else if (aiResponse) {
      // Extract places and region from AI response via LLM
      const extracted = await extractPlacesFromResponse(aiResponse);
      region = extracted.region;
      extractedPlaces = extracted.places;
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
    const normalizedExtracted = extractedPlaces.map((ep) => normalizeName(ep.name));

    function findMatched(dbPlaces: Place[]): Place[] {
      return dbPlaces.filter((dp) => {
        const dn = normalizeName(dp.name);
        return normalizedExtracted.some((en) => tokenMatch(dn, en));
      });
    }

    function findUnmatchedExtracted(): ExtractedPlace[] {
      return extractedPlaces.filter((ep) => {
        const en = normalizeName(ep.name);
        return !allPlaces.some((dp) => tokenMatch(normalizeName(dp.name), en));
      });
    }

    let unmatched = findUnmatchedExtracted();

    // Step 5: Crawl DiningCode for unmatched places and add results to allPlaces
    if (unmatched.length > 0) {
      try {
        const rawPlaces = await crawlDiningCode(region);
        if (rawPlaces.length > 0) {
          const merged = deduplicatePlaces(rawPlaces);
          for (const place of merged) {
            if (!place.lat || !place.lng) {
              const addr = place.address || `${region} ${place.name}`;
              const g = await geocode(addr);
              if (g) { place.lat = g.lat; place.lng = g.lng; place.address = place.address || g.address; }
            }
          }
          const typeMap = await classifyPlaces(
            merged.map((p) => ({ name: p.name, category: p.category, tags: p.tags, description: p.description }))
          );
          const placesForSave = merged.map((p) => ({ ...p, placeType: typeMap[p.name] || undefined }));
          await saveCrawledPlaces(placesForSave);
          console.log(`[resolve] DiningCode crawl saved ${placesForSave.length} places for "${region}"`);

          // Add crawled results to allPlaces so matching can find them
          const existingNames = new Set(allPlaces.map((p) => p.name.toLowerCase()));
          for (const cp of merged) {
            if (!cp.lat || !cp.lng) continue;
            if (existingNames.has(cp.name.toLowerCase())) continue;
            const pType = typeMap[cp.name] || "restaurant";
            allPlaces.push({
              id: `crawled-${cp.name.replace(/\s+/g, "_").toLowerCase()}`,
              name: cp.name,
              description: cp.description || `${region} ${cp.name}`,
              lat: cp.lat,
              lng: cp.lng,
              type: pType as "restaurant",
              category: cp.category || "맛집",
              priceRange: "미정",
              atmosphere: "미정",
              goodFor: "미정",
              rating: cp.rating || 0,
              reviewCount: cp.reviewCount || 0,
              parkingAvailable: false,
              nearbyParking: null,
              tags: cp.tags,
            });
          }
        }
      } catch (err) {
        console.error("[resolve] DiningCode crawl error:", err);
      }
    }

    // Step 5.5: For still-unmatched places, try DiningCode crawl by specific name
    unmatched = findUnmatchedExtracted();
    if (unmatched.length > 0) {
      console.log(
        `[resolve] Still unmatched after region crawl (${unmatched.length}): ${unmatched.map((ep) => ep.name).join(", ")}`
      );
      for (const ep of unmatched) {
        try {
          const nameRaw = await crawlDiningCode(`${region} ${ep.name}`);
          if (nameRaw.length > 0) {
            const nameMerged = deduplicatePlaces(nameRaw);
            for (const place of nameMerged) {
              if (!place.lat || !place.lng) {
                const addr = place.address || `${region} ${place.name}`;
                const g = await geocode(addr);
                if (g) { place.lat = g.lat; place.lng = g.lng; place.address = place.address || g.address; }
              }
            }
            await saveCrawledPlaces(nameMerged);
            const existingNames = new Set(allPlaces.map((p) => p.name.toLowerCase()));
            for (const cp of nameMerged) {
              if (!cp.lat || !cp.lng) continue;
              if (existingNames.has(cp.name.toLowerCase())) continue;
              allPlaces.push({
                id: `crawled-${cp.name.replace(/\s+/g, "_").toLowerCase()}`,
                name: cp.name,
                description: cp.description || `${region} ${cp.name}`,
                lat: cp.lat,
                lng: cp.lng,
                type: "restaurant" as const,
                category: cp.category || "맛집",
                priceRange: "미정",
                atmosphere: "미정",
                goodFor: "미정",
                rating: cp.rating || 0,
                reviewCount: cp.reviewCount || 0,
                parkingAvailable: false,
                nearbyParking: null,
                tags: cp.tags,
              });
            }
            console.log(`[resolve] DiningCode name crawl for "${ep.name}" found ${nameMerged.length} places`);
          }
        } catch (err) {
          console.error(`[resolve] DiningCode name crawl error for "${ep.name}":`, err);
        }
      }
    }

    // Step 5.6: For still-unmatched places, resolve coordinates via place search
    unmatched = findUnmatchedExtracted();
    if (unmatched.length > 0) {
      console.log(
        `[resolve] Still unmatched after name crawl (${unmatched.length}): ${unmatched.map((ep) => ep.name).join(", ")}`
      );
      for (const ep of unmatched) {
        const resolved = await resolvePlace(ep.name, region);
        if (!resolved) {
          console.log(`[resolve] Could not resolve "${ep.name}" — skipping`);
          continue;
        }
        console.log(
          `[resolve] Resolved "${ep.name}" (${ep.type}) via ${resolved.method}: ${resolved.lat},${resolved.lng}`
        );

        let place: Place;
        if (ep.type === "parking") {
          place = {
            id: `resolved-${ep.name}`,
            name: ep.name,
            description: `${region} ${ep.name}`,
            lat: resolved.lat,
            lng: resolved.lng,
            type: "parking" as const,
            parkingType: "공영",
            capacity: 0,
            hourlyRate: 0,
            operatingHours: "미정",
          };
        } else if (ep.type === "cafe") {
          place = {
            id: `resolved-${ep.name}`,
            name: ep.name,
            description: `${region} ${ep.name}`,
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
          };
        } else if (ep.type === "bar") {
          place = {
            id: `resolved-${ep.name}`,
            name: ep.name,
            description: `${region} ${ep.name}`,
            lat: resolved.lat,
            lng: resolved.lng,
            type: "bar" as const,
            category: "바",
            priceRange: "미정",
            atmosphere: "미정",
            goodFor: "미정",
            rating: 0,
            reviewCount: 0,
            parkingAvailable: false,
            nearbyParking: null,
          };
        } else if (ep.type === "bakery") {
          place = {
            id: `resolved-${ep.name}`,
            name: ep.name,
            description: `${region} ${ep.name}`,
            lat: resolved.lat,
            lng: resolved.lng,
            type: "bakery" as const,
            specialty: "미정",
            priceRange: "미정",
            atmosphere: "미정",
            goodFor: "미정",
            rating: 0,
            reviewCount: 0,
            parkingAvailable: false,
            nearbyParking: null,
          };
        } else {
          place = {
            id: `resolved-${ep.name}`,
            name: ep.name,
            description: `${region} ${ep.name}`,
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
        }
        allPlaces.push(place);
      }
    }

    // Step 6: Build result — use matched places only (chat AI's picks), preserving AI recommendation order
    const matchedUnordered = findMatched(allPlaces);
    const matchedPlaces = extractedPlaces
      .map((ep) => {
        const en = normalizeName(ep.name);
        return matchedUnordered.find((dp) => tokenMatch(normalizeName(dp.name), en));
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
