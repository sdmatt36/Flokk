import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { generateCityItinerary } from "@/lib/generate-city-itinerary";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ citySlug: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { citySlug } = await params;
  const result = await generateCityItinerary(citySlug);
  return NextResponse.json(result);
}
