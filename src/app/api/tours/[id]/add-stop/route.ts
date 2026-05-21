import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { resolveProfileId } from "@/lib/profile-access";
import { addStopToTour, type CategoryOptions, type StopCategory, type MealType } from "@/lib/tour-stop-insertion";

export const maxDuration = 30;

const STATUS_MAP: Record<string, number> = {
  tour_not_found:           404,
  wrong_owner:              403,
  too_few_stops:            400,
  already_has_this_category:400,
  not_implemented:          501,
  invalid_options:          400,
  no_meal_gap:              422,
  no_candidates:            422,
  all_filtered_out:         422,
  internal_error:           500,
};

const VALID_CATEGORIES = new Set<StopCategory>(["food", "bathroom", "snack", "photo_spot", "rest"]);
const VALID_MEAL_TYPES  = new Set<MealType>(["auto", "breakfast", "lunch", "dinner"]);

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
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (typeof body.category !== "string" || !VALID_CATEGORIES.has(body.category as StopCategory)) {
    return NextResponse.json(
      { reason: "invalid_options", message: "Invalid or missing category." },
      { status: 400 }
    );
  }
  const category = body.category as StopCategory;

  let options: CategoryOptions;
  if (category === "food") {
    const mealType: MealType =
      typeof body.mealType === "string" && VALID_MEAL_TYPES.has(body.mealType as MealType)
        ? (body.mealType as MealType)
        : "auto";
    options = { category: "food", mealType };
  } else {
    options = { category } as CategoryOptions;
  }

  let result;
  try {
    result = await addStopToTour(tourId, profileId, options);
  } catch {
    return NextResponse.json(
      { reason: "internal_error", message: "Couldn't add a stop. Try again." },
      { status: 500 }
    );
  }

  if (!result.ok) {
    const status = STATUS_MAP[result.reason] ?? 400;
    return NextResponse.json({ reason: result.reason, message: result.message }, { status });
  }

  return NextResponse.json({ tourStop: result.tourStop, pickedPlace: result.pickedPlace, allStops: result.allStops });
}
