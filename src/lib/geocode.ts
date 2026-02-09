interface GeocodeResult {
  lat: number;
  lng: number;
  address: string;
}

/** Common Seoul landmarks for fast fallback */
export const LANDMARK_MAP: Record<string, GeocodeResult> = {
  용산구청: { lat: 37.5324, lng: 126.9906, address: "서울특별시 용산구 녹사평대로 150" },
  이태원: { lat: 37.5345, lng: 126.9945, address: "서울특별시 용산구 이태원동" },
  이태원역: { lat: 37.5345, lng: 126.9945, address: "서울특별시 용산구 이태원동" },
  한남동: { lat: 37.5340, lng: 127.0020, address: "서울특별시 용산구 한남동" },
  경리단길: { lat: 37.5390, lng: 126.9875, address: "서울특별시 용산구 회나무로" },
  녹사평: { lat: 37.5345, lng: 126.9870, address: "서울특별시 용산구 녹사평대로" },
  녹사평역: { lat: 37.5345, lng: 126.9870, address: "서울특별시 용산구 녹사평대로" },
  해방촌: { lat: 37.5420, lng: 126.9870, address: "서울특별시 용산구 용산동2가" },
  강남역: { lat: 37.4979, lng: 127.0276, address: "서울특별시 강남구 강남대로 396" },
  강남: { lat: 37.4979, lng: 127.0276, address: "서울특별시 강남구" },
  홍대: { lat: 37.5563, lng: 126.9220, address: "서울특별시 마포구 와우산로" },
  홍대입구: { lat: 37.5563, lng: 126.9220, address: "서울특별시 마포구 양화로" },
  홍대입구역: { lat: 37.5563, lng: 126.9220, address: "서울특별시 마포구 양화로" },
  명동: { lat: 37.5636, lng: 126.9860, address: "서울특별시 중구 명동" },
  잠실: { lat: 37.5133, lng: 127.1001, address: "서울특별시 송파구 잠실동" },
  여의도: { lat: 37.5219, lng: 126.9245, address: "서울특별시 영등포구 여의도동" },
  신촌: { lat: 37.5551, lng: 126.9368, address: "서울특별시 서대문구 신촌동" },
  건대: { lat: 37.5404, lng: 127.0699, address: "서울특별시 광진구 능동로" },
  건대입구: { lat: 37.5404, lng: 127.0699, address: "서울특별시 광진구 능동로" },
  성수: { lat: 37.5445, lng: 127.0557, address: "서울특별시 성동구 성수동" },
  성수동: { lat: 37.5445, lng: 127.0557, address: "서울특별시 성동구 성수동" },
  을지로: { lat: 37.5660, lng: 126.9910, address: "서울특별시 중구 을지로" },
  종로: { lat: 37.5700, lng: 126.9920, address: "서울특별시 종로구 종로" },
  압구정: { lat: 37.5270, lng: 127.0280, address: "서울특별시 강남구 압구정동" },
  청담: { lat: 37.5255, lng: 127.0470, address: "서울특별시 강남구 청담동" },
  서울역: { lat: 37.5547, lng: 126.9707, address: "서울특별시 용산구 한강대로" },
  용산역: { lat: 37.5298, lng: 126.9648, address: "서울특별시 용산구 한강대로" },
  삼성역: { lat: 37.5090, lng: 127.0640, address: "서울특별시 강남구 테헤란로" },
  선릉역: { lat: 37.5047, lng: 127.0490, address: "서울특별시 강남구 테헤란로" },
  망원: { lat: 37.5567, lng: 126.9100, address: "서울특별시 마포구 망원동" },
  연남동: { lat: 37.5660, lng: 126.9250, address: "서울특별시 마포구 연남동" },
  이촌: { lat: 37.5220, lng: 126.9720, address: "서울특별시 용산구 이촌동" },
  한강진역: { lat: 37.5398, lng: 126.9975, address: "서울특별시 용산구 한남동" },
};

/** Try local landmark map first (only for short landmark queries, not full addresses) */
function lookupLandmark(query: string): GeocodeResult | null {
  // Exact match
  if (LANDMARK_MAP[query]) return LANDMARK_MAP[query];
  // Skip partial match for full addresses (contain numbers → house/building numbers)
  if (/\d/.test(query)) return null;
  // Partial match only for short landmark-like queries
  for (const [key, val] of Object.entries(LANDMARK_MAP)) {
    if (query.includes(key) || key.includes(query)) return val;
  }
  return null;
}

/** Naver Cloud Platform Geocoding API */
async function naverGeocode(query: string): Promise<GeocodeResult | null> {
  const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
  const clientSecret = process.env.NAVER_MAP_CLIENT_SECRET;

  if (!clientId || !clientSecret) return null;

  try {
    const url = new URL(
      "https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode"
    );
    url.searchParams.set("query", query);

    const res = await fetch(url.toString(), {
      headers: {
        "X-NCP-APIGW-API-KEY-ID": clientId,
        "X-NCP-APIGW-API-KEY": clientSecret,
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!data.addresses || data.addresses.length === 0) return null;

    const addr = data.addresses[0];
    return {
      lat: parseFloat(addr.y),
      lng: parseFloat(addr.x),
      address: addr.roadAddress || addr.jibunAddress || query,
    };
  } catch {
    return null;
  }
}

/** Nominatim (OpenStreetMap) free geocoder fallback */
async function nominatimGeocode(query: string): Promise<GeocodeResult | null> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", `${query} 서울`);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "kr");

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "DiningDiscoveryApp/1.0" },
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!data || data.length === 0) return null;

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      address: data[0].display_name || query,
    };
  } catch {
    return null;
  }
}

/** Geocode with cascading fallback: landmark → Naver → Nominatim */
export async function geocode(query: string): Promise<GeocodeResult | null> {
  // 1. Fast landmark lookup
  const landmark = lookupLandmark(query);
  if (landmark) return landmark;

  // 2. Naver Geocoding API
  const naver = await naverGeocode(query);
  if (naver) return naver;

  // 3. Nominatim fallback
  const osm = await nominatimGeocode(query);
  if (osm) return osm;

  console.error("Geocode failed for:", query);
  return null;
}
