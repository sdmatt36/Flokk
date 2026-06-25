import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  addStopToTour,
  type StopCategory,
  type MealType,
  type PrefetchedCandidate,
} from "@/lib/tour-stop-insertion";

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

const VALID_CATEGORIES = new Set<StopCategory>(["food", "bathroom", "snack", "photo_spot", "rest", "kids"]);
const VALID_MEAL_TYPES  = new Set<MealType>(["auto", "breakfast", "lunch", "dinner"]);

function parsePrefetchedCandidate(v: unknown): PrefetchedCandidate | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "object") return undefined;
  const c = v as Record<string, unknown>;
  if (typeof c.name !== "string" || typeof c.durationMin !== "number") return undefined;
  return {
    name:           c.name,
    address:        typeof c.address === "string" ? c.address : null,
    lat:            typeof c.lat === "number" ? c.lat : null,
    lng:            typeof c.lng === "number" ? c.lng : null,
    durationMin:    c.durationMin,
    why:            typeof c.why === "string" ? c.why : null,
    familyNote:     typeof c.familyNote === "string" ? c.familyNote : null,
    imageUrl:       typeof c.imageUrl === "string" ? c.imageUrl : null,
    websiteUrl:     typeof c.websiteUrl === "string" ? c.websiteUrl : null,
    placeId:        typeof c.placeId === "string" ? c.placeId : null,
    ticketRequired: typeof c.ticketRequired === "string" ? c.ticketRequired : null,
    placeTypes:     Array.isArray(c.placeTypes) ? (c.placeTypes as unknown[]).filter((x): x is string => typeof x === "string") : [],
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ reason: "unauthorized", message: "Unauthorized." }, { status: 401 });

  const { id: tourId } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (typeof body.category !== "string" || !VALID_CATEGORIES.has(body.category as StopCategory)) {
    return NextResponse.json(
      { reason: "invalid_options", message: "Invalid or missing category." },
      { status: 400 }
    );
  }
  const category = body.category as StopCategory;

  const mealType: MealType | undefined =
    category === "food"
      ? typeof body.mealType === "string" && VALID_MEAL_TYPES.has(body.mealType as MealType)
        ? (body.mealType as MealType)
        : "auto"
      : undefined;

  const prefetchedCandidate = parsePrefetchedCandidate(body.prefetchedCandidate);
  const insertAfterStopId = typeof body.insertAfterStopId === "string" ? body.insertAfterStopId : undefined;

  let result;
  try {
    result = await addStopToTour({ tourId, userId, category, mealType, prefetchedCandidate, insertAfterStopId });
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
