import { getOpenRouter, MODEL, extractJson } from "@/lib/openrouter";
import type { AgentState, RawCrawledPlace } from "../state";
import { googleSearch } from "../utils/google-search";

export async function suyoFoodTalkAgent(
  state: AgentState
): Promise<Partial<AgentState>> {
  const { searchTerms } = state;

  try {
    const results = await googleSearch(`수요미식회 ${searchTerms}`);
    if (results.length === 0) {
      return { crawledPlaces: [] };
    }

    // Collect snippets for LLM extraction
    const snippetText = results
      .slice(0, 5)
      .map((r) => `제목: ${r.title}\n내용: ${r.snippet}`)
      .join("\n---\n");

    const completion = await getOpenRouter().chat.completions.create({
      model: MODEL,
      temperature: 0,
      max_tokens: 4000,
      messages: [
        {
          role: "system",
          content: `아래 검색 결과에서 수요미식회에 소개된 맛집 이름을 추출하세요.
JSON 배열로 반환: [{"name": "가게이름", "snippet": "관련 설명"}]
맛집 이름만 추출하고 다른 텍스트는 포함하지 마세요.
맛집을 찾을 수 없으면 빈 배열 []을 반환하세요.`,
        },
        { role: "user", content: snippetText },
      ],

    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return { crawledPlaces: [] };

    const parsed = JSON.parse(extractJson(content));
    const items: { name: string; snippet?: string }[] = Array.isArray(parsed)
      ? parsed
      : parsed.places || parsed.restaurants || [];

    const places: RawCrawledPlace[] = items.map((item) => ({
      name: item.name,
      source: "suyo",
      snippet: item.snippet,
      sourceUrl: results[0]?.url,
    }));

    return { crawledPlaces: places.slice(0, 10) };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("SuyoFoodTalk agent error:", msg);
    return { crawledPlaces: [], agentErrors: [`suyo: ${msg}`] };
  }
}
