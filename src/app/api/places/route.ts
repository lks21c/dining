import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Place } from "@/types/place";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const swLat = parseFloat(searchParams.get("swLat") || "0");
  const swLng = parseFloat(searchParams.get("swLng") || "0");
  const neLat = parseFloat(searchParams.get("neLat") || "0");
  const neLng = parseFloat(searchParams.get("neLng") || "0");

  if (!swLat && !swLng && !neLat && !neLng) {
    return NextResponse.json(
      { error: "Bounds parameters required" },
      { status: 400 }
    );
  }

  const boundsWhere = {
    lat: { gte: swLat, lte: neLat },
    lng: { gte: swLng, lte: neLng },
  };

  const [restaurants, cafes, parkingLots] = await Promise.all([
    prisma.restaurant.findMany({ where: boundsWhere }),
    prisma.cafe.findMany({ where: boundsWhere }),
    prisma.parkingLot.findMany({ where: boundsWhere }),
  ]);

  const places: Place[] = [
    ...restaurants.map((r) => ({
      ...r,
      type: "restaurant" as const,
    })),
    ...cafes.map((c) => ({
      ...c,
      type: "cafe" as const,
    })),
    ...parkingLots.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      lat: p.lat,
      lng: p.lng,
      type: "parking" as const,
      parkingType: p.type,
      capacity: p.capacity,
      hourlyRate: p.hourlyRate,
      operatingHours: p.operatingHours,
    })),
  ];

  return NextResponse.json(places);
}
