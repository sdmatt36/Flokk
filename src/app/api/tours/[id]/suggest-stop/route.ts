import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { resolveBathroomCandidate, resolveSnackCandidate, resolvePhotoSpotCandidate, resolveRestCandidate, resolveKidsCandidate } from "@/lib/tour-stop-insertion";

export const maxDuration = 30;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    console.log("[suggest-stop] reason=unauthorized");
    return NextResponse.json({ reason: "unauthorized", message: "Unauthorized." }, { status: 401 });
  }

  const { id: tourId } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // Optional names to skip (e.g. places already shown this session via "Show
  // another"), so a refresh returns a different place. Absent = current behavior.
  const excludeNames = Array.isArray(body.excludeNames)
    ? body.excludeNames.filter((n): n is string => typeof n === "string")
    : undefined;

  let result;
  switch (body.category) {
    case "bathroom":
      result = await resolveBathroomCandidate({ tourId, userId, excludeNames });
      break;
    case "snack":
      result = await resolveSnackCandidate({ tourId, userId, excludeNames });
      break;
    case "photo_spot":
      result = await resolvePhotoSpotCandidate({ tourId, userId, excludeNames });
      break;
    case "rest":
      result = await resolveRestCandidate({ tourId, userId, excludeNames });
      break;
    case "kids":
      result = await resolveKidsCandidate({ tourId, userId, excludeNames });
      break;
    default:
      console.log(`[suggest-stop] tourId=${tourId} reason=unsupported_category category=${body.category}`);
      return NextResponse.json(
        { reason: "unsupported_category", message: `Category "${body.category}" is not supported by this endpoint.` },
        { status: 400 }
      );
  }

  if ("error" in result) {
    console.log(`[suggest-stop] tourId=${tourId} category=${body.category} reason=${result.error}`);
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({ candidate: result.candidate, insertAfterStopId: result.insertAfterStopId });
}
