// Workstream 1A proximity badge helper — pure functions, no side effects.
import { haversineKm } from "./geo";

export type ProximityResult =
  | { kind: "lodging"; minutes: number; mode: "walk" | "drive"; lodgingName: string }
  | { kind: "activity"; activityTitle: string; dayLabel: string | null }
  | { kind: "none" };

export type ActivityForProximity = {
  title: string;
  lat: number;
  lng: number;
  dayIndex: number | null;
};

const ACTIVITY_PROXIMITY_KM = 2;
const WALK_THRESHOLD_KM = 2;
const WALK_SPEED_MIN_PER_KM = 12;
const DRIVE_SPEED_MIN_PER_KM = 1.5;

export function computeProximity(
  recLat: number | null,
  recLng: number | null,
  lodgingLat: number | null,
  lodgingLng: number | null,
  lodgingName: string | null,
  plannedActivities: ActivityForProximity[]
): ProximityResult {
  if (recLat == null || recLng == null) return { kind: "none" };

  // Activity-relative check first (overrides lodging when within 2km)
  let closestActivity: ActivityForProximity | null = null;
  let closestDist = Infinity;
  for (const act of plannedActivities) {
    const d = haversineKm({ lat: recLat, lng: recLng }, { lat: act.lat, lng: act.lng });
    if (d <= ACTIVITY_PROXIMITY_KM && d < closestDist) {
      closestActivity = act;
      closestDist = d;
    }
  }
  if (closestActivity) {
    return {
      kind: "activity",
      activityTitle: closestActivity.title,
      dayLabel: closestActivity.dayIndex != null ? `Day ${closestActivity.dayIndex + 1}` : null,
    };
  }

  // Lodging-relative fallback
  if (lodgingLat != null && lodgingLng != null && lodgingName) {
    const km = haversineKm({ lat: recLat, lng: recLng }, { lat: lodgingLat, lng: lodgingLng });
    const mode: "walk" | "drive" = km <= WALK_THRESHOLD_KM ? "walk" : "drive";
    const minutes = Math.max(1, Math.round(km * (mode === "walk" ? WALK_SPEED_MIN_PER_KM : DRIVE_SPEED_MIN_PER_KM)));
    return { kind: "lodging", minutes, mode, lodgingName };
  }

  return { kind: "none" };
}

export function formatProximityLabel(result: ProximityResult): string | null {
  if (result.kind === "none") return null;
  if (result.kind === "activity") {
    const dayPart = result.dayLabel ? ` (your ${result.dayLabel} plan)` : " (your plan)";
    return `Near ${result.activityTitle}${dayPart}`;
  }
  return `${result.minutes} min ${result.mode} from ${result.lodgingName}`;
}
