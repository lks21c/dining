import { openrouter, MODEL, extractJson } from "@/lib/openrouter";
import type { Place, PlaceType, Course, CourseStop } from "@/types/place";

function compressPlace(
  place: Place,
  index: number,
  anchor?: { lat: number; lng: number }
): string {
  const prefix =
    place.type === "restaurant" ? "R" : place.type === "cafe" ? "C" : "P";
  const id = `${prefix}${index}`;

  const distStr = anchor ? `|${calcDistanceM(anchor.lat, anchor.lng, place.lat, place.lng)}m` : "";

  if (place.type === "restaurant") {
    return `${id}|${place.name}|${place.category}|${place.priceRange}|${place.atmosphere}|${place.goodFor}|★${place.rating}|주차${place.parkingAvailable ? "O" : "X"}${distStr}`;
  }
  if (place.type === "cafe") {
    return `${id}|${place.name}|${place.specialty}|${place.priceRange}|${place.atmosphere}|${place.goodFor}|★${place.rating}|주차${place.parkingAvailable ? "O" : "X"}${distStr}`;
  }
  return `${id}|${place.name}|${place.parkingType}|${place.hourlyRate}원/시|${place.capacity}대|${place.operatingHours}${distStr}`;
}

export function calcDistanceM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function buildSystemPrompt(anchor?: { lat: number; lng: number; name: string }): string {
  const anchorInstruction = anchor
    ? `\n앵커 위치: ${anchor.name} (${anchor.lat}, ${anchor.lng})
- 각 장소까지의 거리(m)가 데이터에 포함되어 있습니다.
- 앵커 기준으로 최소 이동 동선을 구성하세요.
- 걸어서 이동 가능한 범위(도보 15분, ~1km)를 우선하세요.`
    : "";

  return `당신은 한국 맛집 추천 전문 AI입니다.
사용자의 자연어 요청을 분석하여 여러 코스를 조합해서 추천합니다.
${anchorInstruction}

역할:
1. 사용자 맥락 파싱 (누구와, 목적, 분위기, 예산, 위치)
2. 사용자의 모든 조건을 AND로 결합하여 필터링
3. 맛집+카페/디저트 조합으로 여러 코스를 구성
4. 각 코스마다 방문 순서 제안

응답은 반드시 다음 JSON 형식으로:
{
  "summary": "(아래 작성 가이드 참조 — 풍부하고 상세하게 작성할 것)",
  "persona": "사용자 맥락 요약",
  "courses": [
    {
      "courseNumber": 1,
      "title": "맛집명 + 카페명 코스",
      "stops": [
        { "order": 1, "id": "P1", "type": "parking", "reason": "추천 이유" },
        { "order": 2, "id": "R3", "type": "restaurant", "reason": "추천 이유" },
        { "order": 3, "id": "C2", "type": "cafe", "reason": "추천 이유" }
      ],
      "routeSummary": "주차장 → 도보5분 → 맛집 → 도보3분 → 카페"
    }
  ]
}

★ 코스 구성 규칙 (가장 중요):
- 코스는 2~4개 생성 (데이터가 적으면 최소 1개)
- 각 코스의 기본 구성: 맛집 1개 + 카페/디저트 1개
- 디저트 전문점, 테이크아웃, 베이커리 등이 있으면 추가 stop으로 넣어도 됨
- 차로 이동하는 경우("차대고", "주차") 각 코스에 주차장 1개를 첫 번째로 배치 (같은 주차장 공유 가능)
- 각 코스는 서로 다른 특색 (예: 고기코스, 해산물코스, 이탈리안코스 등)
- title은 핵심 장소명 조합 (예: "육몽 + 콩카페", "바토스 + 오띠젤리")
- 같은 카페가 다른 맛집과 조합되어도 OK
- 같은 맛집이 다른 카페와 조합되어도 OK

★ summary 작성 가이드:
summary는 사용자에게 직접 보여주는 메인 텍스트입니다:

1) 도입부 (2-3문장): 해당 지역의 특성, 주차 상황, 접근성 등 유용한 정보
2) 추천 가능한 맛집/카페 소개 (번호 매겨서):
   - **장소명** (볼드)
   - 어떤 곳인지 2-3문장 상세 설명 (대표 메뉴, 맛의 특징, 분위기 등)
   - 특징: 한줄 요약
   - 평점: 데이터에 있으면 표기
3) 마무리 팁 (1-2문장): 주차 팁, 예약 팁, 방문 시간 팁 등

규칙:
- type은 반드시 "restaurant", "cafe", "parking" 중 하나
- id는 입력된 장소 목록의 ID를 그대로 사용
- JSON만 응답, 다른 텍스트 금지
- summary 안에서 줄바꿈은 \\n 사용
- 조건에 맞는 장소가 부족하면 가장 가까운 대안을 추천하되, 이유에 "대안" 명시`;
}

/* ---------- LLM response types ---------- */

interface LLMCourseStop {
  order: number;
  id: string;
  type: PlaceType;
  reason: string;
}

interface LLMCourse {
  courseNumber: number;
  title: string;
  stops: LLMCourseStop[];
  routeSummary: string;
}

interface LLMResponse {
  summary: string;
  persona: string;
  courses: LLMCourse[];
}

/* ---------- Public API ---------- */

export interface ExtractLocationResult {
  location: string | null;
  error?: string;
}

export async function extractLocation(query: string): Promise<ExtractLocationResult> {
  try {
    const completion = await openrouter.chat.completions.create({
      model: MODEL,
      temperature: 0,
      max_tokens: 2000,
      messages: [
        {
          role: "system",
          content: `사용자 요청에서 지명/장소명을 추출하세요.
"~에", "~에서", "~근처", "~앞", "~주변" 등의 위치 표현에서 장소명만 추출합니다.
위치 표현이 없으면 "NONE"을 반환합니다.
장소명만 반환, 다른 텍스트 금지.

예시:
- "용산구청에 차대고 갈만한 맛집" → "용산구청"
- "홍대 근처 카페" → "홍대"
- "강남역 주변 맛집" → "강남역"
- "혼밥하기 좋은 조용한 곳" → "NONE"
- "4인 가족 이태원 맛집" → "이태원"`,
        },
        { role: "user", content: query },
      ],
    });

    const result = completion.choices[0]?.message?.content?.trim();
    if (!result || result === "NONE") return { location: null };
    return { location: result };
  } catch (error) {
    console.error("Location extraction error:", error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return { location: null, error: errMsg };
  }
}

export interface GetRecommendationsResult {
  summary: string;
  persona: string;
  courses: Course[];
  /** Set when LLM failed and fallback was used */
  warning?: string;
}

export async function getRecommendations(
  query: string,
  places: Place[],
  anchor?: { lat: number; lng: number; name: string }
): Promise<GetRecommendationsResult> {
  const idMap = new Map<string, Place>();
  const compressed = places.map((p, i) => {
    const prefix =
      p.type === "restaurant" ? "R" : p.type === "cafe" ? "C" : "P";
    const id = `${prefix}${i}`;
    idMap.set(id, p);
    return compressPlace(p, i, anchor);
  });

  const userMessage = `장소 목록:
${compressed.join("\n")}

사용자 요청: ${query}`;

  try {
    const completion = await openrouter.chat.completions.create({
      model: MODEL,
      temperature: 0.5,
      max_tokens: 16000,
      messages: [
        { role: "system", content: buildSystemPrompt(anchor) },
        { role: "user", content: userMessage },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("No response from LLM");

    const parsed: LLMResponse = JSON.parse(extractJson(content));

    // Map compressed IDs back to real IDs in every course
    const courses: Course[] = parsed.courses.map((c) => ({
      courseNumber: c.courseNumber,
      title: c.title,
      routeSummary: c.routeSummary,
      stops: c.stops
        .filter((s) => idMap.has(s.id))
        .map((s) => {
          const place = idMap.get(s.id)!;
          return { ...s, id: place.id, type: place.type } as CourseStop;
        }),
    }));

    return {
      summary: parsed.summary,
      persona: parsed.persona,
      courses,
    };
  } catch (error) {
    console.error("LLM error, falling back to keyword search:", error);
    const errMsg = error instanceof Error ? error.message : String(error);
    const isAuthError = errMsg.includes("401") || errMsg.includes("403") || errMsg.includes("API key");
    const isModelError = errMsg.includes("404") || errMsg.includes("No allowed providers");
    const warning = isAuthError
      ? "AI 추천 서비스에 연결할 수 없습니다 (API 키 오류). 키워드 기반 검색 결과를 대신 표시합니다."
      : isModelError
      ? "AI 모델에 연결할 수 없습니다 (모델 설정 오류). 키워드 기반 검색 결과를 대신 표시합니다."
      : "AI 추천 서비스에 일시적 오류가 발생했습니다. 키워드 기반 검색 결과를 대신 표시합니다.";
    return { ...keywordFallback(query, places), warning };
  }
}

/* ---------- Fallback ---------- */

function keywordFallback(query: string, places: Place[]): GetRecommendationsResult {
  const keywords = query.toLowerCase().split(/\s+/);

  const scored = places.map((place) => {
    let score = 0;
    const searchText = [
      place.name,
      place.description,
      place.type === "restaurant"
        ? `${place.category} ${place.atmosphere} ${place.goodFor}`
        : "",
      place.type === "cafe"
        ? `${place.specialty} ${place.atmosphere} ${place.goodFor}`
        : "",
      place.type === "parking"
        ? `${place.parkingType} ${place.operatingHours}`
        : "",
    ]
      .join(" ")
      .toLowerCase();

    for (const kw of keywords) {
      if (searchText.includes(kw)) score++;
    }
    return { place, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const restaurants = scored.filter((s) => s.place.type === "restaurant" && s.score > 0).slice(0, 3);
  const cafes = scored.filter((s) => s.place.type === "cafe" && s.score > 0).slice(0, 2);

  // If no keyword matches, use top rated
  const fallbackRestaurants = restaurants.length > 0
    ? restaurants
    : scored.filter((s) => s.place.type === "restaurant").slice(0, 2);
  const fallbackCafes = cafes.length > 0
    ? cafes
    : scored.filter((s) => s.place.type === "cafe").slice(0, 1);

  // Build courses: pair each restaurant with a cafe
  const courses: Course[] = fallbackRestaurants.map((r, i) => {
    const cafe = fallbackCafes[i % fallbackCafes.length];
    const stops: CourseStop[] = [
      { order: 1, id: r.place.id, type: r.place.type, reason: `인기 맛집` },
    ];
    if (cafe) {
      stops.push({
        order: 2,
        id: cafe.place.id,
        type: cafe.place.type,
        reason: `인기 카페`,
      });
    }
    const title = cafe
      ? `${r.place.name} + ${cafe.place.name}`
      : r.place.name;
    return {
      courseNumber: i + 1,
      title,
      stops,
      routeSummary: stops.map((s) => {
        const p = s.id === r.place.id ? r.place : cafe?.place;
        return p?.name || "";
      }).join(" → "),
    };
  });

  const allNames = [...fallbackRestaurants.map((r) => r.place.name), ...fallbackCafes.map((c) => c.place.name)];
  return {
    summary: `"${query}" 검색 결과입니다. ${allNames.join(", ")} 등을 조합한 코스를 추천드려요!`,
    persona: query,
    courses: courses.length > 0 ? courses : [{
      courseNumber: 1,
      title: "추천 코스",
      stops: scored.slice(0, 3).map((s, i) => ({
        order: i + 1,
        id: s.place.id,
        type: s.place.type,
        reason: "키워드 매칭",
      })),
      routeSummary: scored.slice(0, 3).map((s) => s.place.name).join(" → "),
    }],
  };
}
