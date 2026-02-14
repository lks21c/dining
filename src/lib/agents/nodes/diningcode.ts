import type { AgentState, RawCrawledPlace } from "../state";
import { fetchHtml, parseHtml } from "../utils/scraper";

/**
 * Extract listData from DiningCode list page.
 * DiningCode stores POI data (name, address, lat/lng) in a localStorage script.
 */
function extractListData(html: string): DiningCodePoi[] {
  const $ = parseHtml(html);
  let listDataRaw = "";

  $("script").each((_, el) => {
    const text = $(el).html() || "";
    const match = text.match(
      /localStorage\.setItem\('listData',\s*'(.+?)'\)/
    );
    if (match) {
      listDataRaw = match[1];
    }
  });

  if (!listDataRaw) return [];

  try {
    // The string is double-escaped JSON — parse the JS string first.
    // DiningCode sometimes includes \' (JS-escaped single quotes) which
    // are not valid JSON escape sequences, so strip them before parsing.
    const sanitized = listDataRaw.replace(/\\'/g, "'");
    const unescaped = JSON.parse(`"${sanitized}"`);
    const data = JSON.parse(unescaped);
    const list = data?.poi_section?.list;
    if (!Array.isArray(list)) return [];
    // Dev: log first POI keys to discover tag-related fields
    if (list.length > 0) {
      console.log("[DiningCode] POI keys:", Object.keys(list[0]).join(", "));
    }
    return list;
  } catch {
    return [];
  }
}

interface DiningCodePoi {
  v_rid: string;
  nm: string;
  branch?: string;
  addr?: string;
  road_addr?: string;
  lat?: number;
  lng?: number;
  category?: string;
  score?: number;
  keyword?: { term: string; mark: number }[] | string;
  hash?: { term: string; mark: number }[] | string;
}

/**
 * Crawl DiningCode for a single search term and return raw place data.
 * Extracts POI list directly from the list page's embedded localStorage data,
 * which includes coordinates, addresses (both jibun & road), and profile IDs.
 */
export async function crawlDiningCode(
  searchTerm: string
): Promise<RawCrawledPlace[]> {
  const encoded = encodeURIComponent(searchTerm);
  const url = `https://www.diningcode.com/list.dc?query=${encoded}`;
  const html = await fetchHtml(url);

  const poiList = extractListData(html);
  const $ = parseHtml(html);

  // Build a map of restaurant name → keyword tags from HTML cards
  const htmlTagMap = new Map<string, string>();
  $(".PoiBlock, .dc-poi, li[class*='poi']").each((_, el) => {
    const nameEl = $(el).find(".InfoHeader, .tit, .name").first();
    const tagEl = $(el).find(".Hash, .Category, .keyword, .tag").first();
    const cardName = nameEl.text().trim();
    const tagText = tagEl.text().trim();
    if (cardName && tagText) {
      htmlTagMap.set(cardName, tagText.replace(/#/g, "").trim());
    }
  });

  return poiList.slice(0, 20).map((poi) => {
    const name = poi.branch ? `${poi.nm} ${poi.branch}` : poi.nm;
    // Extract tags: keyword/hash can be array of {term, mark} or string
    const extractTerms = (
      field: { term: string; mark: number }[] | string | undefined
    ): string | undefined => {
      if (!field) return undefined;
      if (typeof field === "string") return field;
      if (Array.isArray(field) && field.length > 0) {
        return field.map((t) => t.term).join(", ");
      }
      return undefined;
    };
    const tags =
      extractTerms(poi.keyword) ||
      extractTerms(poi.hash) ||
      htmlTagMap.get(poi.nm) ||
      undefined;
    const score = poi.score ?? undefined;
    return {
      name,
      address: poi.road_addr || poi.addr,
      lat: poi.lat,
      lng: poi.lng,
      source: "diningcode",
      sourceUrl: poi.v_rid
        ? `https://www.diningcode.com/profile.php?rid=${poi.v_rid}`
        : undefined,
      tags,
      rating: score,
      metadata: JSON.stringify({ score: score ?? null }),
    };
  });
}

/**
 * Re-export for the fix-coordinates script: fetch a DiningCode search page
 * and return POI data including coordinates.
 */
export async function searchDiningCodePois(
  query: string
): Promise<DiningCodePoi[]> {
  const encoded = encodeURIComponent(query);
  const url = `https://www.diningcode.com/list.dc?query=${encoded}`;
  const html = await fetchHtml(url);
  return extractListData(html);
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
