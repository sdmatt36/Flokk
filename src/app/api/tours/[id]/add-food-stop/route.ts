import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { resolveProfileId } from "@/lib/profile-access";
import { addFoodStopToTour } from "@/lib/tour-stop-insertion";

export const maxDuration = 30;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const { id: tourId } = await params;
  const result = await addFoodStopToTour(tourId, profileId);

  if ("error" in result) {
    const status =
      result.error === "Forbidden" ? 403 :
      result.error === "Tour not found" ? 404 :
      400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ stop: result.stop });
}
