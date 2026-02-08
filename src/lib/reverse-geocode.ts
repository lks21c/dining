import { LANDMARK_MAP } from "./geocode";

interface AreaInfo {
  gu: string;
  dong: string;
}

/**
 * Reverse geocode coordinates to gu/dong names using Naver Reverse Geocode API.
 * Falls back to nearest landmark from LANDMARK_MAP.
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<AreaInfo | null> {
  // 1. Try Naver Reverse Geocode API
  const naver = await naverReverseGeocode(lat, lng);
  if (naver) return naver;

  // 2. Fallback: find nearest landmark
  return findNearestLandmark(lat, lng);
}

async function naverReverseGeocode(
  lat: number,
  lng: number
): Promise<AreaInfo | null> {
  const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
  const clientSecret = process.env.NAVER_MAP_CLIENT_SECRET;

  if (!clientId || !clientSecret) return null;

  try {
    const url = new URL(
      "https://naveropenapi.apigw.ntruss.com/map-reversegeocode/v2/gc"
    );
    url.searchParams.set("coords", `${lng},${lat}`);
    url.searchParams.set("orders", "legalcode");
    url.searchParams.set("output", "json");

    const res = await fetch(url.toString(), {
      headers: {
        "X-NCP-APIGW-API-KEY-ID": clientId,
        "X-NCP-APIGW-API-KEY": clientSecret,
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const results = data?.results;
    if (!results || results.length === 0) return null;

    const region = results[0]?.region;
    if (!region) return null;

    const gu = region.area2?.name || "";
    const dong = region.area3?.name || "";

    if (!gu && !dong) return null;
    return { gu, dong };
  } catch {
    return null;
  }
}

function findNearestLandmark(
  lat: number,
  lng: number
): AreaInfo | null {
  let minDist = Infinity;
  let nearest: string | null = null;

  for (const [name, coords] of Object.entries(LANDMARK_MAP)) {
    const dLat = coords.lat - lat;
    const dLng = coords.lng - lng;
    const dist = dLat * dLat + dLng * dLng;
    if (dist < minDist) {
      minDist = dist;
      nearest = name;
    }
  }

  if (!nearest) return null;

  // Extract gu from the landmark's address
  const landmark = LANDMARK_MAP[nearest];
  const guMatch = landmark.address.match(/([\uAC00-\uD7A3]+[구])/);
  const gu = guMatch ? guMatch[1] : "";

  // Use the landmark name as dong approximation
  return { gu, dong: nearest };
}
