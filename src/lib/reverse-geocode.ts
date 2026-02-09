interface AreaInfo {
  gu: string;
  dong: string;
}

/**
 * Reverse geocode coordinates to gu/dong names using Naver Reverse Geocode API.
 * Falls back to Seoul gu/dong boundary lookup.
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<AreaInfo | null> {
  // 1. Try Naver Reverse Geocode API
  const naver = await naverReverseGeocode(lat, lng);
  if (naver) return naver;

  // 2. Fallback: gu/dong boundary lookup
  return findAreaByBounds(lat, lng);
}

async function naverReverseGeocode(
  lat: number,
  lng: number
): Promise<AreaInfo | null> {
  const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
  const clientSecret = process.env.NAVER_MAP_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.log("[reverseGeocode] Naver API keys missing");
    return null;
  }

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

    if (!res.ok) {
      console.log(`[reverseGeocode] Naver API error: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = await res.json();
    const results = data?.results;
    if (!results || results.length === 0) {
      console.log("[reverseGeocode] Naver API: no results");
      return null;
    }

    const region = results[0]?.region;
    if (!region) return null;

    const gu = region.area2?.name || "";
    const dong = region.area3?.name || "";

    if (!gu && !dong) return null;
    console.log(`[reverseGeocode] Naver API → gu=${gu}, dong=${dong}`);
    return { gu, dong };
  } catch (err) {
    console.log("[reverseGeocode] Naver API exception:", err);
    return null;
  }
}

/**
 * Seoul gu/dong area definitions with center coordinates.
 * Used as fallback when Naver API is unavailable.
 * Each entry has a center point and representative dong names.
 */
export interface SeoulArea {
  gu: string;
  dong: string;
  lat: number;
  lng: number;
}

export const SEOUL_AREAS: SeoulArea[] = [
  // 강남구
  { gu: "강남구", dong: "역삼동", lat: 37.5007, lng: 127.0365 },
  { gu: "강남구", dong: "삼성동", lat: 37.5090, lng: 127.0640 },
  { gu: "강남구", dong: "청담동", lat: 37.5255, lng: 127.0470 },
  { gu: "강남구", dong: "압구정동", lat: 37.5270, lng: 127.0280 },
  { gu: "강남구", dong: "논현동", lat: 37.5133, lng: 127.0280 },
  { gu: "강남구", dong: "신사동", lat: 37.5237, lng: 127.0230 },
  { gu: "강남구", dong: "대치동", lat: 37.4940, lng: 127.0580 },
  // 강동구
  { gu: "강동구", dong: "천호동", lat: 37.5390, lng: 127.1235 },
  { gu: "강동구", dong: "길동", lat: 37.5325, lng: 127.1370 },
  { gu: "강동구", dong: "명일동", lat: 37.5500, lng: 127.1450 },
  // 강북구
  { gu: "강북구", dong: "미아동", lat: 37.6130, lng: 127.0270 },
  { gu: "강북구", dong: "수유동", lat: 37.6370, lng: 127.0170 },
  // 강서구
  { gu: "강서구", dong: "화곡동", lat: 37.5480, lng: 126.8490 },
  { gu: "강서구", dong: "발산동", lat: 37.5580, lng: 126.8380 },
  { gu: "강서구", dong: "마곡동", lat: 37.5660, lng: 126.8280 },
  // 관악구
  { gu: "관악구", dong: "신림동", lat: 37.4840, lng: 126.9290 },
  { gu: "관악구", dong: "봉천동", lat: 37.4780, lng: 126.9510 },
  { gu: "관악구", dong: "낙성대", lat: 37.4770, lng: 126.9640 },
  // 광진구
  { gu: "광진구", dong: "구의동", lat: 37.5380, lng: 127.0860 },
  { gu: "광진구", dong: "자양동", lat: 37.5350, lng: 127.0710 },
  { gu: "광진구", dong: "건대입구", lat: 37.5404, lng: 127.0699 },
  // 구로구
  { gu: "구로구", dong: "구로동", lat: 37.4955, lng: 126.8870 },
  { gu: "구로구", dong: "신도림동", lat: 37.5090, lng: 126.8910 },
  { gu: "구로구", dong: "디지털단지", lat: 37.4850, lng: 126.9010 },
  // 금천구
  { gu: "금천구", dong: "가산동", lat: 37.4780, lng: 126.8870 },
  { gu: "금천구", dong: "독산동", lat: 37.4680, lng: 126.8960 },
  // 노원구
  { gu: "노원구", dong: "공릉동", lat: 37.6260, lng: 127.0730 },
  { gu: "노원구", dong: "상계동", lat: 37.6540, lng: 127.0680 },
  // 도봉구
  { gu: "도봉구", dong: "창동", lat: 37.6530, lng: 127.0470 },
  { gu: "도봉구", dong: "쌍문동", lat: 37.6480, lng: 127.0340 },
  // 동대문구
  { gu: "동대문구", dong: "회기동", lat: 37.5890, lng: 127.0560 },
  { gu: "동대문구", dong: "전농동", lat: 37.5760, lng: 127.0580 },
  // 동작구
  { gu: "동작구", dong: "상도동", lat: 37.4980, lng: 126.9530 },
  { gu: "동작구", dong: "노량진동", lat: 37.5130, lng: 126.9420 },
  { gu: "동작구", dong: "사당동", lat: 37.4860, lng: 126.9810 },
  { gu: "동작구", dong: "흑석동", lat: 37.5080, lng: 126.9630 },
  { gu: "동작구", dong: "동작동", lat: 37.5000, lng: 126.9720 },
  // 마포구
  { gu: "마포구", dong: "합정동", lat: 37.5500, lng: 126.9130 },
  { gu: "마포구", dong: "망원동", lat: 37.5567, lng: 126.9100 },
  { gu: "마포구", dong: "연남동", lat: 37.5660, lng: 126.9250 },
  { gu: "마포구", dong: "상수동", lat: 37.5475, lng: 126.9225 },
  { gu: "마포구", dong: "서교동", lat: 37.5525, lng: 126.9215 },
  { gu: "마포구", dong: "공덕동", lat: 37.5440, lng: 126.9520 },
  // 서대문구
  { gu: "서대문구", dong: "신촌동", lat: 37.5551, lng: 126.9368 },
  { gu: "서대문구", dong: "연희동", lat: 37.5680, lng: 126.9350 },
  // 서초구
  { gu: "서초구", dong: "서초동", lat: 37.4920, lng: 127.0070 },
  { gu: "서초구", dong: "방배동", lat: 37.4810, lng: 126.9890 },
  { gu: "서초구", dong: "반포동", lat: 37.5070, lng: 127.0050 },
  { gu: "서초구", dong: "잠원동", lat: 37.5170, lng: 127.0100 },
  // 성동구
  { gu: "성동구", dong: "성수동", lat: 37.5445, lng: 127.0557 },
  { gu: "성동구", dong: "왕십리", lat: 37.5610, lng: 127.0370 },
  { gu: "성동구", dong: "옥수동", lat: 37.5410, lng: 127.0170 },
  // 성북구
  { gu: "성북구", dong: "성북동", lat: 37.5930, lng: 127.0060 },
  { gu: "성북구", dong: "돈암동", lat: 37.5910, lng: 127.0180 },
  { gu: "성북구", dong: "길음동", lat: 37.6060, lng: 127.0230 },
  // 송파구
  { gu: "송파구", dong: "잠실동", lat: 37.5133, lng: 127.1001 },
  { gu: "송파구", dong: "가락동", lat: 37.4980, lng: 127.1180 },
  { gu: "송파구", dong: "문정동", lat: 37.4860, lng: 127.1220 },
  { gu: "송파구", dong: "방이동", lat: 37.5130, lng: 127.1170 },
  // 양천구
  { gu: "양천구", dong: "목동", lat: 37.5270, lng: 126.8750 },
  { gu: "양천구", dong: "신정동", lat: 37.5190, lng: 126.8560 },
  // 영등포구
  { gu: "영등포구", dong: "여의도동", lat: 37.5219, lng: 126.9245 },
  { gu: "영등포구", dong: "영등포동", lat: 37.5160, lng: 126.9050 },
  { gu: "영등포구", dong: "당산동", lat: 37.5340, lng: 126.9020 },
  // 용산구
  { gu: "용산구", dong: "이태원동", lat: 37.5345, lng: 126.9945 },
  { gu: "용산구", dong: "한남동", lat: 37.5340, lng: 127.0020 },
  { gu: "용산구", dong: "용산동", lat: 37.5298, lng: 126.9648 },
  { gu: "용산구", dong: "이촌동", lat: 37.5220, lng: 126.9720 },
  { gu: "용산구", dong: "해방촌", lat: 37.5420, lng: 126.9870 },
  { gu: "용산구", dong: "녹사평", lat: 37.5345, lng: 126.9870 },
  // 은평구
  { gu: "은평구", dong: "응암동", lat: 37.5860, lng: 126.9180 },
  { gu: "은평구", dong: "불광동", lat: 37.6100, lng: 126.9290 },
  // 종로구
  { gu: "종로구", dong: "종로", lat: 37.5700, lng: 126.9920 },
  { gu: "종로구", dong: "삼청동", lat: 37.5830, lng: 126.9820 },
  { gu: "종로구", dong: "북촌", lat: 37.5820, lng: 126.9850 },
  { gu: "종로구", dong: "익선동", lat: 37.5740, lng: 126.9920 },
  // 중구
  { gu: "중구", dong: "명동", lat: 37.5636, lng: 126.9860 },
  { gu: "중구", dong: "을지로", lat: 37.5660, lng: 126.9910 },
  { gu: "중구", dong: "충무로", lat: 37.5610, lng: 126.9940 },
  // 중랑구
  { gu: "중랑구", dong: "면목동", lat: 37.5860, lng: 127.0850 },
  { gu: "중랑구", dong: "상봉동", lat: 37.5970, lng: 127.0870 },
  // 강남 외곽
  { gu: "강남구", dong: "개포동", lat: 37.4810, lng: 127.0540 },
  { gu: "강남구", dong: "수서동", lat: 37.4870, lng: 127.1020 },
];

/**
 * Find the nearest known dong from SEOUL_AREAS by coordinate distance.
 * Much better coverage than the old LANDMARK_MAP approach.
 */
function findAreaByBounds(lat: number, lng: number): AreaInfo | null {
  let minDist = Infinity;
  let nearest: (typeof SEOUL_AREAS)[number] | null = null;

  for (const area of SEOUL_AREAS) {
    const dLat = area.lat - lat;
    const dLng = area.lng - lng;
    const dist = dLat * dLat + dLng * dLng;
    if (dist < minDist) {
      minDist = dist;
      nearest = area;
    }
  }

  if (!nearest) return null;

  console.log(`[reverseGeocode] fallback → gu=${nearest.gu}, dong=${nearest.dong} (dist²=${minDist.toFixed(6)})`);
  return { gu: nearest.gu, dong: nearest.dong };
}
