interface GeocodeResult {
  lat: number;
  lng: number;
  address: string;
}

export async function geocode(query: string): Promise<GeocodeResult | null> {
  const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
  const clientSecret = process.env.NAVER_MAP_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("Naver Maps API credentials not configured");
    return null;
  }

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

    if (!res.ok) {
      console.error("Geocode API error:", res.status, await res.text());
      return null;
    }

    const data = await res.json();

    if (!data.addresses || data.addresses.length === 0) {
      return null;
    }

    const addr = data.addresses[0];
    return {
      lat: parseFloat(addr.y),
      lng: parseFloat(addr.x),
      address: addr.roadAddress || addr.jibunAddress || query,
    };
  } catch (error) {
    console.error("Geocode error:", error);
    return null;
  }
}
