import type { AgentState, RawCrawledPlace } from "../state";
import { fetchHtml, parseHtml } from "../utils/scraper";

/**
 * Crawl DiningCode for a single search term and return raw place data.
 * Uses JSON-LD schema embedded in list pages for reliable extraction.
 */
export async function crawlDiningCode(
  searchTerm: string
): Promise<RawCrawledPlace[]> {
  const encoded = encodeURIComponent(searchTerm);
  const url = `https://www.diningcode.com/list.dc?query=${encoded}`;
  const html = await fetchHtml(url);
  const $ = parseHtml(html);

  const places: RawCrawledPlace[] = [];

  // Extract from JSON-LD schema (reliable structure)
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || "");
      const items = data.itemListElement;
      if (!Array.isArray(items)) return;

      for (const item of items) {
        const name = item.name?.trim();
        const profileUrl = item.url;
        if (!name) continue;

        places.push({
          name,
          source: "diningcode",
          sourceUrl: profileUrl || undefined,
        });
      }
    } catch {
      // skip malformed JSON-LD
    }
  });

  return places.slice(0, 20);
}

export async function diningcodeAgent(
  state: AgentState
): Promise<Partial<AgentState>> {
  try {
    const places = await crawlDiningCode(state.searchTerms);
    return { crawledPlaces: places };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("DiningCode agent error:", msg);
    return { crawledPlaces: [], agentErrors: [`diningcode: ${msg}`] };
  }
}
