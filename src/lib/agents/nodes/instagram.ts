import { openrouter, MODEL, extractJson } from "@/lib/openrouter";
import type { AgentState, RawCrawledPlace } from "../state";
import { googleSearch } from "../utils/google-search";

export async function instagramAgent(
  state: AgentState
): Promise<Partial<AgentState>> {
  const { searchTerms } = state;

  try {
    const results = await googleSearch(
      `site:instagram.com ${searchTerms} 맛집`
    );
    if (results.length === 0) {
      return { crawledPlaces: [] };
    }

    const snippetText = results
      .slice(0, 5)
      .map((r) => `게시물: ${r.title}\n설명: ${r.snippet}\nURL: ${r.url}`)
      .join("\n---\n");

    const completion = await openrouter.chat.completions.create({
      model: MODEL,
      temperature: 0,
      max_tokens: 4000,
      messages: [
        {
          role: "system",
          content: `아래 Instagram 검색 결과에서 언급된 맛집 이름을 추출하세요.
해시태그에서 맛집 이름을 찾을 수 있습니다.
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
      source: "instagram",
      snippet: item.snippet,
      sourceUrl: results[0]?.url,
    }));

    return { crawledPlaces: places.slice(0, 10) };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Instagram agent error:", msg);
    return { crawledPlaces: [], agentErrors: [`instagram: ${msg}`] };
  }
}
