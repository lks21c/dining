import type { AgentState, RawCrawledPlace } from "../state";
import { fetchHtml, parseHtml } from "../utils/scraper";

export async function naverPlaceAgent(
  state: AgentState
): Promise<Partial<AgentState>> {
  const { searchTerms } = state;

  try {
    const encoded = encodeURIComponent(searchTerms);
    const url = `https://m.place.naver.com/restaurant/list?query=${encoded}`;
    const html = await fetchHtml(url);
    const $ = parseHtml(html);

    const places: RawCrawledPlace[] = [];

    // Naver mobile place page embeds JSON data in script tags
    $("script").each((_, el) => {
      const text = $(el).html() || "";
      // Look for __APOLLO_STATE__ or similar data payload
      const match = text.match(/"items"\s*:\s*(\[[\s\S]*?\])\s*[,}]/);
      if (match) {
        try {
          const items = JSON.parse(match[1]);
          for (const item of items) {
            if (item.name) {
              places.push({
                name: item.name,
                category: item.category || item.businessCategory,
                address: item.address || item.roadAddress,
                lat: item.y ? parseFloat(item.y) : undefined,
                lng: item.x ? parseFloat(item.x) : undefined,
                rating: item.rating ? parseFloat(item.rating) : undefined,
                reviewCount: item.reviewCount
                  ? parseInt(item.reviewCount, 10)
                  : undefined,
                source: "naver",
                sourceUrl: item.id
                  ? `https://m.place.naver.com/restaurant/${item.id}`
                  : undefined,
              });
            }
          }
        } catch {
          // JSON parse failed, skip
        }
      }
    });

    // Fallback: parse visible list items if script parsing yields nothing
    if (places.length === 0) {
      $("li[data-id], .place_bluelink, a[href*='/restaurant/']").each(
        (_, el) => {
          const name = $(el).find(".place_bluelink, .TYaxT, a").first().text().trim();
          if (name && !places.some((p) => p.name === name)) {
            places.push({
              name,
              source: "naver",
              sourceUrl: $(el).find("a").first().attr("href") || undefined,
            });
          }
        }
      );
    }

    return { crawledPlaces: places.slice(0, 20) };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Naver Place agent error:", msg);
    return { crawledPlaces: [], agentErrors: [`naver: ${msg}`] };
  }
}
