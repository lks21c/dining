import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { fetchHtml, parseHtml } from "../src/lib/agents/utils/scraper";

const dbPath = resolve(__dirname, "..", "dev.db");
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

const DELAY_MS = 500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface MenuEntry {
  menu: string;
  best: number;
  price: string;
  rank: number;
}

/** Extract menuData JSON array from profile page HTML */
function extractMenuData(html: string): MenuEntry[] {
  const match = html.match(/const\s+menuData\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) return [];
  try {
    return JSON.parse(match[1]);
  } catch {
    return [];
  }
}

/** Extract first profile URL from DiningCode search results page */
function extractFirstProfileUrl(html: string): string | null {
  // Try JSON-LD schema first
  const $ = parseHtml(html);
  const scripts = $('script[type="application/ld+json"]');
  for (let i = 0; i < scripts.length; i++) {
    try {
      const data = JSON.parse($(scripts[i]).html() || "");
      if (data.itemListElement?.length > 0) {
        const url = data.itemListElement[0].url;
        if (url && url.includes("profile.php")) return url;
      }
    } catch {
      // continue
    }
  }
  // Fallback: look for profile links in HTML
  const link = $('a[href*="profile.php?rid="]').first().attr("href");
  if (link) {
    return link.startsWith("http")
      ? link
      : `https://www.diningcode.com${link.startsWith("/") ? "" : "/"}${link}`;
  }
  return null;
}

/** Generate tags string from menuData: best menus first, else top 3 by rank */
function generateTags(menuData: MenuEntry[]): string | null {
  const bestMenus = menuData.filter((m) => m.best === 1);
  if (bestMenus.length > 0) {
    return bestMenus.map((m) => m.menu).join(", ");
  }
  const top3 = [...menuData].sort((a, b) => a.rank - b.rank).slice(0, 3);
  if (top3.length > 0) {
    return top3.map((m) => m.menu).join(", ");
  }
  return null;
}

interface CrawlResult {
  menus: { menuName: string; price: string | null }[];
  tags: string | null;
}

async function crawlMenusForPlace(
  placeName: string,
  existingSourceUrl?: string
): Promise<CrawlResult> {
  const empty: CrawlResult = { menus: [], tags: null };
  let profileUrl = existingSourceUrl || null;

  // Step 1: Find profile URL if not provided
  if (!profileUrl) {
    const searchUrl = `https://www.diningcode.com/list.dc?query=${encodeURIComponent(placeName)}`;
    try {
      const searchHtml = await fetchHtml(searchUrl);
      profileUrl = extractFirstProfileUrl(searchHtml);
    } catch (e) {
      console.log(`  ⚠️ Search failed for "${placeName}": ${e}`);
      return empty;
    }
    if (!profileUrl) {
      console.log(`  ⚠️ No profile found for "${placeName}"`);
      return empty;
    }
    await sleep(DELAY_MS);
  }

  // Step 2: Fetch profile page and extract menuData
  try {
    const profileHtml = await fetchHtml(profileUrl);
    const menuData = extractMenuData(profileHtml);
    if (menuData.length === 0) {
      console.log(`  ⚠️ No menu data on profile for "${placeName}"`);
      return empty;
    }

    const tags = generateTags(menuData);

    // Take top-ranked menus (up to 10)
    const sorted = [...menuData].sort((a, b) => a.rank - b.rank).slice(0, 10);
    return {
      menus: sorted.map((m) => ({
        menuName: m.menu,
        price: m.price || null,
      })),
      tags,
    };
  } catch (e) {
    console.log(`  ⚠️ Profile fetch failed for "${placeName}": ${e}`);
    return empty;
  }
}

async function main() {
  console.log("🍽️ DiningCode 메뉴 크롤링 시작\n");

  // Collect all places to crawl (exclude parking)
  const restaurants = await prisma.restaurant.findMany({ select: { name: true } });
  const cafes = await prisma.cafe.findMany({ select: { name: true } });
  const crawledPlaces = await prisma.crawledPlace.findMany({
    where: {
      NOT: {
        category: { contains: "주차" },
      },
    },
    select: {
      name: true,
      sources: {
        where: { source: "diningcode" },
        select: { sourceUrl: true },
      },
    },
  });

  // Build unique place list with optional diningcode sourceUrl
  const placeMap = new Map<string, string | undefined>();

  for (const r of restaurants) placeMap.set(r.name, undefined);
  for (const c of cafes) placeMap.set(c.name, undefined);
  for (const cp of crawledPlaces) {
    const dcSource = cp.sources.find((s) => s.sourceUrl);
    placeMap.set(cp.name, dcSource?.sourceUrl ?? undefined);
  }

  const places = [...placeMap.entries()];
  console.log(`📊 총 ${places.length}개 장소 크롤링 예정\n`);

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < places.length; i++) {
    const [name, sourceUrl] = places[i];
    const progress = `[${i + 1}/${places.length}]`;

    // Check if already crawled
    const existing = await prisma.menu.findFirst({ where: { placeName: name } });
    if (existing) {
      console.log(`${progress} ⏭️ "${name}" - 이미 크롤링됨`);
      skipped++;
      continue;
    }

    console.log(`${progress} 🔍 "${name}"...`);
    const result = await crawlMenusForPlace(name, sourceUrl);

    if (result.menus.length === 0) {
      failed++;
      await sleep(DELAY_MS);
      continue;
    }

    // Save menus to DB
    for (const m of result.menus) {
      try {
        await prisma.menu.create({
          data: {
            placeName: name,
            menuName: m.menuName,
            price: m.price,
            source: "diningcode",
          },
        });
      } catch {
        // unique constraint - skip duplicate
      }
    }

    // Save tags to CrawledPlace
    if (result.tags) {
      const cp = await prisma.crawledPlace.findFirst({ where: { name } });
      if (cp) {
        await prisma.crawledPlace.update({
          where: { id: cp.id },
          data: { tags: result.tags },
        });
        console.log(`  🏷️ 태그: ${result.tags}`);
      }
    }

    console.log(`  ✅ ${result.menus.length}개 메뉴 저장`);
    success++;
    await sleep(DELAY_MS);
  }

  const totalMenus = await prisma.menu.count();
  console.log(`\n📊 크롤링 완료:`);
  console.log(`  ✅ 성공: ${success}개 장소`);
  console.log(`  ⏭️ 스킵: ${skipped}개 장소`);
  console.log(`  ❌ 실패: ${failed}개 장소`);
  console.log(`  📦 총 메뉴: ${totalMenus}개`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
