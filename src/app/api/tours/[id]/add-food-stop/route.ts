import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { resolveProfileId } from "@/lib/profile-access";
import { addFoodStopToTour } from "@/lib/tour-stop-insertion";
import type { MealType } from "@/lib/tour-stop-insertion";

export const maxDuration = 30;

const STATUS_MAP: Record<string, number> = {
  tour_not_found: 404,
  wrong_owner: 403,
  too_few_stops: 400,
  already_has_food_stop: 400,
  no_meal_gap: 422,
  no_candidates: 422,
  all_filtered_out: 422,
  internal_error: 500,
};

const VALID_MEAL_TYPES = new Set(["breakfast", "lunch", "dinner", "auto"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ reason: "unauthorized", message: "Unauthorized." }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId)
    return NextResponse.json({ reason: "unauthorized", message: "Profile not found." }, { status: 404 });

  const { id: tourId } = await params;

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const mealType: MealType =
    typeof body.mealType === "string" && VALID_MEAL_TYPES.has(body.mealType)
      ? (body.mealType as MealType)
      : "auto";

  let result;
  try {
    result = await addFoodStopToTour(tourId, profileId, mealType);
  } catch {
    return NextResponse.json(
      { reason: "internal_error", message: "Couldn't add a food stop. Try again." },
      { status: 500 }
    );
  }

  if (!result.ok) {
    const status = STATUS_MAP[result.reason] ?? 400;
    return NextResponse.json({ reason: result.reason, message: result.message }, { status });
  }

  return NextResponse.json({ tourStop: result.tourStop, pickedPlace: result.pickedPlace });
}
