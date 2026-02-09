/**
 * Fix coordinates for CrawledPlaces with duplicate coords.
 * Uses DiningCode's listData POI data which includes lat/lng directly.
 *
 * Strategy:
 * 1. Find CrawledPlaces grouped by their dong/area
 * 2. Search DiningCode for each area → get POI list with coordinates
 * 3. Match by name and update coordinates
 */
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { searchDiningCodePois } from "../src/lib/agents/nodes/diningcode";

const dbPath = resolve(__dirname, "..", "dev.db");
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Normalize name for matching: strip whitespace, lowercase */
function normalize(name: string): string {
  return name.replace(/\s+/g, "").toLowerCase();
}

async function main() {
  console.log("🔧 좌표 수정 시작 (DiningCode listData 방식)\n");

  // 1. Find duplicate coordinate groups
  const all = await prisma.crawledPlace.findMany({
    select: { id: true, name: true, lat: true, lng: true, address: true },
  });

  const coordGroups = new Map<string, typeof all>();
  for (const p of all) {
    if (p.lat == null || p.lng == null) continue;
    const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
    if (!coordGroups.has(key)) coordGroups.set(key, []);
    coordGroups.get(key)!.push(p);
  }

  // Filter groups with 5+ places at same point
  const dupeGroups = [...coordGroups.entries()].filter(
    ([, places]) => places.length >= 5
  );

  if (dupeGroups.length === 0) {
    console.log("✅ 중복 좌표 그룹이 없습니다.");
    await prisma.$disconnect();
    return;
  }

  console.log(`📊 ${dupeGroups.length}개 중복 좌표 그룹 발견\n`);

  // 2. Extract area/dong from addresses to form search queries
  for (const [coord, places] of dupeGroups) {
    console.log(`\n📍 ${coord} → ${places.length}개 장소`);

    // Extract dong names from addresses
    const dongs = new Set<string>();
    for (const p of places) {
      if (!p.address) continue;
      const dongMatch = p.address.match(/([가-힣]+동)\s/);
      if (dongMatch) dongs.add(dongMatch[1]);
    }

    if (dongs.size === 0) {
      console.log("  ⚠️ 동 이름을 추출할 수 없음");
      continue;
    }

    // Search DiningCode for each dong and build a coordinate map
    const poiMap = new Map<string, { lat: number; lng: number; road_addr?: string; addr?: string }>();

    for (const dong of dongs) {
      const searchQuery = `${dong} 맛집`;
      console.log(`  🔍 DiningCode 검색: "${searchQuery}"`);

      const pois = await searchDiningCodePois(searchQuery);
      console.log(`     → ${pois.length}개 POI`);

      for (const poi of pois) {
        const fullName = poi.branch ? `${poi.nm} ${poi.branch}` : poi.nm;
        if (poi.lat && poi.lng) {
          poiMap.set(normalize(fullName), {
            lat: poi.lat,
            lng: poi.lng,
            road_addr: poi.road_addr,
            addr: poi.addr,
          });
          // Also store without branch
          if (poi.branch) {
            poiMap.set(normalize(poi.nm), {
              lat: poi.lat,
              lng: poi.lng,
              road_addr: poi.road_addr,
              addr: poi.addr,
            });
          }
        }
      }

      await sleep(500);

      // Also search for cafes
      const cafeQuery = `${dong} 카페`;
      console.log(`  🔍 DiningCode 검색: "${cafeQuery}"`);
      const cafePois = await searchDiningCodePois(cafeQuery);
      console.log(`     → ${cafePois.length}개 POI`);

      for (const poi of cafePois) {
        const fullName = poi.branch ? `${poi.nm} ${poi.branch}` : poi.nm;
        if (poi.lat && poi.lng) {
          poiMap.set(normalize(fullName), {
            lat: poi.lat,
            lng: poi.lng,
            road_addr: poi.road_addr,
            addr: poi.addr,
          });
          if (poi.branch) {
            poiMap.set(normalize(poi.nm), {
              lat: poi.lat,
              lng: poi.lng,
              road_addr: poi.road_addr,
              addr: poi.addr,
            });
          }
        }
      }

      await sleep(500);
    }

    console.log(`  📊 POI 맵: ${poiMap.size}개 항목`);

    // 3. Match places by name and update
    let fixed = 0;
    let notFound = 0;

    for (const place of places) {
      const norm = normalize(place.name);
      const poi = poiMap.get(norm);

      if (poi) {
        const address = poi.road_addr || poi.addr || place.address;
        await prisma.crawledPlace.update({
          where: { id: place.id },
          data: { lat: poi.lat, lng: poi.lng, address },
        });
        console.log(
          `  ✅ "${place.name}" → (${poi.lat.toFixed(4)}, ${poi.lng.toFixed(4)}) ${address || ""}`
        );
        fixed++;
      } else {
        // Try partial matching
        let matched = false;
        for (const [key, val] of poiMap) {
          if (norm.includes(key) || key.includes(norm)) {
            const address = val.road_addr || val.addr || place.address;
            await prisma.crawledPlace.update({
              where: { id: place.id },
              data: { lat: val.lat, lng: val.lng, address },
            });
            console.log(
              `  ⚠️ "${place.name}" → partial match (${val.lat.toFixed(4)}, ${val.lng.toFixed(4)})`
            );
            fixed++;
            matched = true;
            break;
          }
        }
        if (!matched) {
          console.log(`  ❌ "${place.name}" → DiningCode에서 못 찾음`);
          notFound++;
        }
      }
    }

    console.log(`\n  결과: ✅ ${fixed}개 수정, ❌ ${notFound}개 못 찾음`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
