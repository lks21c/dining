import OpenAI from "openai";
import type { AgentState } from "../state";
import { findCachedPlaces } from "../utils/place-cache";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function dispatcher(
  state: AgentState
): Promise<Partial<AgentState>> {
  const { query, location, bounds } = state;

  // Generate optimized Korean search keywords via LLM
  let searchTerms: string;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 100,
      messages: [
        {
          role: "system",
          content: `사용자의 맛집 검색 요청을 크롤링용 한국어 검색 키워드로 변환하세요.
위치 + 음식 종류/분위기를 포함한 간결한 검색어를 만드세요.

예시:
- "용산구청 근처 이탈리안 맛집" → "용산 이탈리안 맛집"
- "강남역 혼밥하기 좋은 곳" → "강남역 혼밥 맛집"
- "홍대 데이트 분위기 좋은 레스토랑" → "홍대 데이트 레스토랑"

검색 키워드만 반환하세요. 다른 텍스트 금지.`,
        },
        { role: "user", content: query },
      ],
    });

    searchTerms = completion.choices[0]?.message?.content?.trim() || query;
  } catch {
    searchTerms = query;
  }

  // Check DB cache for recent crawled data in bounds
  const cached = await findCachedPlaces(bounds);

  return {
    searchTerms,
    crawledPlaces: cached,
  };
}
