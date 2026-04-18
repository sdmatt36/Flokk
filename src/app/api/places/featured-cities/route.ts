import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getFeaturedCities } from "@/lib/featured-cities";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await getFeaturedCities();
  return NextResponse.json(result);
}
