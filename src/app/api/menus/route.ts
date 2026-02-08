import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const placeName = req.nextUrl.searchParams.get("placeName");

  if (!placeName) {
    return NextResponse.json(
      { error: "placeName parameter required" },
      { status: 400 }
    );
  }

  const menus = await prisma.menu.findMany({
    where: { placeName },
    select: { menuName: true, price: true },
  });

  return NextResponse.json(menus);
}
