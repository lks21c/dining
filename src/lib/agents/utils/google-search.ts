import { fetchHtml, parseHtml } from "./scraper";

export interface GoogleResult {
  title: string;
  url: string;
  snippet: string;
}

export async function googleSearch(query: string): Promise<GoogleResult[]> {
  const encoded = encodeURIComponent(query);
  const url = `https://www.google.com/search?q=${encoded}&hl=ko&num=10`;

  try {
    const html = await fetchHtml(url);
    const $ = parseHtml(html);
    const results: GoogleResult[] = [];

    $("div.g").each((_, el) => {
      const titleEl = $(el).find("h3").first();
      const linkEl = $(el).find("a").first();
      const snippetEl = $(el).find("div[data-sncf]").first().length
        ? $(el).find("div[data-sncf]").first()
        : $(el).find(".VwiC3b").first();

      const title = titleEl.text().trim();
      const href = linkEl.attr("href") || "";
      const snippet = snippetEl.text().trim();

      if (title && href.startsWith("http")) {
        results.push({ title, url: href, snippet });
      }
    });

    return results;
  } catch (error) {
    console.error(`Google search failed for "${query}":`, error);
    return [];
  }
}
