import type { AgentState, RawCrawledPlace } from "../state";
import { fetchHtml, parseHtml } from "../utils/scraper";

export async function diningcodeAgent(
  state: AgentState
): Promise<Partial<AgentState>> {
  const { searchTerms } = state;

  try {
    const encoded = encodeURIComponent(searchTerms);
    const url = `https://www.diningcode.com/list.dc?query=${encoded}`;
    const html = await fetchHtml(url);
    const $ = parseHtml(html);

    const places: RawCrawledPlace[] = [];

    // Parse restaurant cards from DiningCode list page
    $(".dc-restaurant-card, .restaurant-item, .PoiBlockCardStyle, li.InfoArea").each(
      (_, el) => {
        const name =
          $(el)
            .find(".title, .Restaurant-name, h2, .InfoHeader a")
            .first()
            .text()
            .trim() || "";
        const category =
          $(el).find(".category, .Cuisine").first().text().trim() || undefined;
        const address =
          $(el).find(".address, .Addr").first().text().trim() || undefined;
        const ratingText =
          $(el).find(".rating, .Score, .point").first().text().trim();
        const rating = ratingText ? parseFloat(ratingText) : undefined;

        if (name) {
          const href = $(el).find("a").first().attr("href");
          places.push({
            name,
            category,
            address,
            rating,
            source: "diningcode",
            sourceUrl: href
              ? href.startsWith("http")
                ? href
                : `https://www.diningcode.com${href}`
              : undefined,
          });
        }
      }
    );

    return { crawledPlaces: places.slice(0, 15) };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("DiningCode agent error:", msg);
    return { crawledPlaces: [], agentErrors: [`diningcode: ${msg}`] };
  }
}
