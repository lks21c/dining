import type { AgentState } from "../state";
import { prisma } from "@/lib/prisma";

// Map lat/lng area to Seoul district (구) name
function getDistrictName(
  lat: number,
  lng: number
): string | null {
  // Major Seoul district coordinate ranges (approximate)
  const districts: { name: string; latMin: number; latMax: number; lngMin: number; lngMax: number }[] = [
    { name: "강남구", latMin: 37.49, latMax: 37.53, lngMin: 127.02, lngMax: 127.07 },
    { name: "서초구", latMin: 37.47, latMax: 37.51, lngMin: 126.98, lngMax: 127.04 },
    { name: "마포구", latMin: 37.54, latMax: 37.57, lngMin: 126.89, lngMax: 126.95 },
    { name: "용산구", latMin: 37.52, latMax: 37.55, lngMin: 126.96, lngMax: 127.00 },
    { name: "종로구", latMin: 37.57, latMax: 37.60, lngMin: 126.97, lngMax: 127.02 },
    { name: "중구", latMin: 37.55, latMax: 37.57, lngMin: 126.97, lngMax: 127.01 },
    { name: "성동구", latMin: 37.55, latMax: 37.57, lngMin: 127.02, lngMax: 127.06 },
    { name: "송파구", latMin: 37.49, latMax: 37.52, lngMin: 127.08, lngMax: 127.14 },
    { name: "영등포구", latMin: 37.52, latMax: 37.54, lngMin: 126.89, lngMax: 126.93 },
    { name: "관악구", latMin: 37.47, latMax: 37.49, lngMin: 126.94, lngMax: 126.98 },
  ];

  for (const d of districts) {
    if (lat >= d.latMin && lat <= d.latMax && lng >= d.lngMin && lng <= d.lngMax) {
      return d.name;
    }
  }
  return null;
}

interface ParkInfoItem {
  PARKING_NAME?: string;
  ADDR?: string;
  LAT?: string;
  LNG?: string;
  CAPACITY?: string;
  RATES?: string;
  TIME_RATES?: string;
  OPERATION_RULE_NM?: string;
  WEEKEND_BEGIN_TIME?: string;
  WEEKEND_END_TIME?: string;
}

export async function parkingAgent(
  state: AgentState
): Promise<Partial<AgentState>> {
  const { location } = state;

  if (!location) {
    return { crawledPlaces: [] };
  }

  try {
    const district = getDistrictName(location.lat, location.lng);
    if (!district) {
      return { crawledPlaces: [], agentErrors: ["parking: could not determine district"] };
    }

    const apiKey = process.env.SEOUL_OPENDATA_API_KEY;
    if (!apiKey) {
      return { crawledPlaces: [], agentErrors: ["parking: SEOUL_OPENDATA_API_KEY not set"] };
    }

    const encoded = encodeURIComponent(district);
    const url = `http://openapi.seoul.go.kr:8088/${apiKey}/json/GetParkInfo/1/50/${encoded}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    let data: { GetParkInfo?: { row?: ParkInfoItem[] } };
    try {
      const res = await fetch(url, { signal: controller.signal });
      data = await res.json();
    } finally {
      clearTimeout(timer);
    }

    const rows = data?.GetParkInfo?.row;
    if (!rows || rows.length === 0) {
      return { crawledPlaces: [] };
    }

    // Upsert parking data into ParkingLot table
    for (const row of rows.slice(0, 30)) {
      const name = row.PARKING_NAME?.trim();
      if (!name) continue;

      const lat = row.LAT ? parseFloat(row.LAT) : null;
      const lng = row.LNG ? parseFloat(row.LNG) : null;
      if (!lat || !lng || lat === 0 || lng === 0) continue;

      const capacity = row.CAPACITY ? parseInt(row.CAPACITY, 10) : 0;
      const hourlyRate = row.RATES ? parseInt(row.RATES, 10) : 0;
      const opType = row.OPERATION_RULE_NM || "공영";
      const hours =
        row.WEEKEND_BEGIN_TIME && row.WEEKEND_END_TIME
          ? `${row.WEEKEND_BEGIN_TIME}~${row.WEEKEND_END_TIME}`
          : "24시간";

      // Check if parking lot already exists by name
      const existing = await prisma.parkingLot.findFirst({
        where: { name },
      });

      if (!existing) {
        await prisma.parkingLot.create({
          data: {
            name,
            type: opType,
            lat,
            lng,
            capacity: isNaN(capacity) ? 0 : capacity,
            hourlyRate: isNaN(hourlyRate) ? 0 : hourlyRate,
            description: `${district} ${opType} 주차장`,
            operatingHours: hours,
          },
        });
      }
    }

    // Parking data goes into ParkingLot table, not crawledPlaces
    return { crawledPlaces: [] };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Parking agent error:", msg);
    return { crawledPlaces: [], agentErrors: [`parking: ${msg}`] };
  }
}
