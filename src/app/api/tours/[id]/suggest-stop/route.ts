import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { resolveBathroomCandidate } from "@/lib/tour-stop-insertion";

export const maxDuration = 30;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    console.log("[bathroom-suggest] reason=unauthorized");
    return NextResponse.json({ reason: "unauthorized", message: "Unauthorized." }, { status: 401 });
  }

  const { id: tourId } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (body.category !== "bathroom") {
    console.log(`[bathroom-suggest] tourId=${tourId} reason=unsupported_category category=${body.category}`);
    return NextResponse.json(
      { reason: "unsupported_category", message: "Only bathroom is supported by this endpoint." },
      { status: 400 }
    );
  }

  let result;
  try {
    result = await resolveBathroomCandidate({ tourId, userId });
  } catch (err) {
    console.error("[bathroom-suggest] internal_error", err);
    return NextResponse.json(
      { reason: "internal_error", message: "Couldn't resolve a bathroom stop. Try again." },
      { status: 500 }
    );
  }

  if ("error" in result) {
    console.log(`[bathroom-suggest] tourId=${tourId} reason=${result.error}`);
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({ candidate: result.candidate, insertAfterStopId: result.insertAfterStopId });
}
