import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractRegion } from "@/lib/place-mapper";
import { LANDMARK_MAP } from "@/lib/geocode";

export interface RegionItem {
  name: string;
  lat: number;
  lng: number;
  count: number; // 0 for landmarks without DB places
}

export async function GET() {
  // 1. Pull places with valid coordinates and addresses
  const rows = await prisma.crawledPlace.findMany({
    where: { address: { not: null }, lat: { not: null }, lng: { not: null } },
    select: { address: true, lat: true, lng: true },
  });

  // 2. Group by region → accumulate lat/lng for centroid
  const regionAcc = new Map<
    string,
    { sumLat: number; sumLng: number; count: number }
  >();

  for (const row of rows) {
    const region = extractRegion(row.address);
    if (!region || region === "기타") continue;
    const acc = regionAcc.get(region) ?? { sumLat: 0, sumLng: 0, count: 0 };
    acc.sumLat += row.lat!;
    acc.sumLng += row.lng!;
    acc.count += 1;
    regionAcc.set(region, acc);
  }

  // 3. Build region list sorted by count (most places first)
  const dbRegions: RegionItem[] = [...regionAcc.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([name, acc]) => ({
      name,
      lat: acc.sumLat / acc.count,
      lng: acc.sumLng / acc.count,
      count: acc.count,
    }));

  // 4. Add LANDMARK_MAP entries (dedup by name against DB regions)
  const dbNames = new Set(dbRegions.map((r) => r.name));
  const landmarks: RegionItem[] = Object.entries(LANDMARK_MAP)
    .filter(([k]) => !dbNames.has(k))
    .map(([name, geo]) => ({
      name,
      lat: geo.lat,
      lng: geo.lng,
      count: 0,
    }));

  return NextResponse.json([...dbRegions, ...landmarks]);
}
