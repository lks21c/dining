import type { Bounds } from "@/types/place";

/**
 * Calculate lat/lng bounds from a center point and radius.
 */
export function boundsFromCenter(
  lat: number,
  lng: number,
  radiusKm: number
): Bounds {
  const latDelta = radiusKm / 111.32;
  const lngDelta = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  return {
    swLat: lat - latDelta,
    neLat: lat + latDelta,
    swLng: lng - lngDelta,
    neLng: lng + lngDelta,
  };
}
