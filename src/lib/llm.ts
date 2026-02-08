import OpenAI from "openai";
import type { Place, PlaceType } from "@/types/place";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function compressPlace(place: Place, index: number): string {
  const prefix = place.type === "restaurant" ? "R" : place.type === "cafe" ? "C" : "P";
  const id = `${prefix}${index}`;

  if (place.type === "restaurant") {
    return `${id}|${place.name}|${place.category}|${place.priceRange}|${place.atmosphere}|${place.goodFor}|★${place.rating}|주차${place.parkingAvailable ? "O" : "X"}`;
  }
  if (place.type === "cafe") {
    return `${id}|${place.name}|${place.specialty}|${place.priceRange}|${place.atmosphere}|${place.goodFor}|★${place.rating}|주차${place.parkingAvailable ? "O" : "X"}`;
  }
  return `${id}|${place.name}|${place.parkingType}|${place.hourlyRate}원/시|${place.capacity}대|${place.operatingHours}`;
}

const SYSTEM_PROMPT = `당신은 한국 외출 플래너 AI 어시스턴트입니다.
사용자의 자연어 요청을 분석하여 맛집, 카페, 주차장을 통합 추천하고 최적 동선을 제안합니다.

역할:
1. 사용자 맥락 파싱 (누구와, 목적, 분위기, 예산)
2. 주어진 장소 목록에서 최적 장소 선택
3. 방문 순서 제안 (주차 → 식사 → 카페 등)
4. 각 장소의 추천 이유 설명

응답은 반드시 다음 JSON 형식으로:
{
  "persona": "사용자 맥락 요약 (예: 40대 부부 데이트)",
  "recommendations": [
    { "order": 1, "id": "P1", "type": "parking", "reason": "추천 이유" },
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
- JSON만 응답, 다른 텍스트 금지`;

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

export async function getRecommendations(
  query: string,
  places: Place[]
): Promise<LLMResponse> {
  const idMap = new Map<string, Place>();
  const compressed = places.map((p, i) => {
    const prefix = p.type === "restaurant" ? "R" : p.type === "cafe" ? "C" : "P";
    const id = `${prefix}${i}`;
    idMap.set(id, p);
    return compressPlace(p, i);
  });

  const userMessage = `장소 목록:
${compressed.join("\n")}

사용자 요청: ${query}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
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
      place.type === "restaurant" ? `${place.category} ${place.atmosphere} ${place.goodFor}` : "",
      place.type === "cafe" ? `${place.specialty} ${place.atmosphere} ${place.goodFor}` : "",
      place.type === "parking" ? `${place.parkingType} ${place.operatingHours}` : "",
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
    // Return random top-rated places
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
      reason: `키워드 매칭: ${keywords.filter((kw) => {
        const text = [s.place.name, s.place.description].join(" ").toLowerCase();
        return text.includes(kw);
      }).join(", ")}`,
    })),
    routeSummary: top.map((s) => s.place.name).join(" → "),
  };
}
