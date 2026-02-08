import OpenAI from "openai";
import type { Place, PlaceType } from "@/types/place";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

  return `당신은 한국 외출 플래너 AI 어시스턴트입니다.
사용자의 자연어 요청을 분석하여 맛집, 카페, 주차장을 통합 추천하고 최적 동선을 제안합니다.
${anchorInstruction}

역할:
1. 사용자 맥락 파싱 (누구와, 목적, 분위기, 예산, 위치)
2. 사용자의 모든 조건을 AND로 결합하여 필터링:
   - 위치 조건: 주어진 장소 목록은 이미 위치 필터링됨
   - 대상 조건: 누구와 가는지에 맞는 분위기/가격대 선택
   - 목적 조건: 차로 이동 → 주차장 필수, 데이트 → 분위기 좋은 곳
   - 장소타입 조건: 맛집+카페 요청 시 둘 다 포함
3. 각 조건을 모두 만족하는 장소만 추천 (조건에 맞지 않으면 추천하지 않음)
4. 방문 순서 제안 (주차 → 식사 → 카페 등)
5. 각 장소의 추천 이유에 어떤 조건을 충족하는지 명시

응답은 반드시 다음 JSON 형식으로:
{
  "persona": "사용자 맥락 요약 (예: 40대 부부, 용산구청 근처, 차량 이동)",
  "recommendations": [
    { "order": 1, "id": "P1", "type": "parking", "reason": "추천 이유 (어떤 조건 충족)" },
    { "order": 2, "id": "R3", "type": "restaurant", "reason": "추천 이유" },
    { "order": 3, "id": "C2", "type": "cafe", "reason": "추천 이유" }
  ],
  "routeSummary": "주차 → 도보 5분 → 이탈리안 디너 → 도보 3분 → 카페"
}

규칙:
- 추천은 3~5개 장소
- 차로 이동하는 경우 주차장을 첫 번째로 추천
- type은 반드시 "restaurant", "cafe", "parking" 중 하나
- id는 입력된 장소 목록의 ID를 그대로 사용
- JSON만 응답, 다른 텍스트 금지
- 조건에 맞는 장소가 부족하면 가장 가까운 대안을 추천하되, 이유에 "대안" 명시`;
}

interface LLMRecommendation {
  order: number;
  id: string;
  type: PlaceType;
  reason: string;
}

interface LLMResponse {
  persona: string;
  recommendations: LLMRecommendation[];
  routeSummary: string;
}

export async function extractLocation(query: string): Promise<string | null> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 100,
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
    if (!result || result === "NONE") return null;
    return result;
  } catch (error) {
    console.error("Location extraction error:", error);
    return null;
  }
}

export async function getRecommendations(
  query: string,
  places: Place[],
  anchor?: { lat: number; lng: number; name: string }
): Promise<LLMResponse> {
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
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: buildSystemPrompt(anchor) },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("No response from LLM");

    const parsed: LLMResponse = JSON.parse(content);

    // Map compressed IDs back to real IDs
    parsed.recommendations = parsed.recommendations
      .filter((rec) => idMap.has(rec.id))
      .map((rec) => {
        const place = idMap.get(rec.id)!;
        return { ...rec, id: place.id, type: place.type };
      });

    return parsed;
  } catch (error) {
    console.error("LLM error, falling back to keyword search:", error);
    return keywordFallback(query, places);
  }
}

function keywordFallback(query: string, places: Place[]): LLMResponse {
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

  const top = scored.slice(0, 5).filter((s) => s.score > 0);
  if (top.length === 0) {
    const sorted = [...places]
      .filter((p) => p.type !== "parking")
      .sort((a, b) => {
        const aRating = "rating" in a ? a.rating : 0;
        const bRating = "rating" in b ? b.rating : 0;
        return bRating - aRating;
      })
      .slice(0, 3);

    return {
      persona: "일반 추천",
      recommendations: sorted.map((p, i) => ({
        order: i + 1,
        id: p.id,
        type: p.type,
        reason: `인기 ${p.type === "restaurant" ? "맛집" : "카페"}`,
      })),
      routeSummary: sorted.map((p) => p.name).join(" → "),
    };
  }

  return {
    persona: query,
    recommendations: top.map((s, i) => ({
      order: i + 1,
      id: s.place.id,
      type: s.place.type,
      reason: `키워드 매칭: ${keywords
        .filter((kw) => {
          const text = [s.place.name, s.place.description]
            .join(" ")
            .toLowerCase();
          return text.includes(kw);
        })
        .join(", ")}`,
    })),
    routeSummary: top.map((s) => s.place.name).join(" → "),
  };
}
