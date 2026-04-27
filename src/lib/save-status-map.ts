import { getEntityStatus, ENTITY_STATUSES } from "./entity-status";
import type { EntityStatusResult } from "./entity-status";

export type SaveStatusFields = {
  dayIndex: number | null;
  hasItineraryLink: boolean;
  hasBooking: boolean;
  userRating: number | null;
  tripStatus: string | null;
  tripEndDate: string | null;
};

export function buildSaveStatusMap(
  saves: Array<{ rawTitle?: string | null; destinationCity?: string | null } & SaveStatusFields>
): Map<string, EntityStatusResult> {
  const map = new Map<string, EntityStatusResult>();

  for (const save of saves) {
    const title = (save.rawTitle ?? "").toLowerCase().trim();
    if (!title) continue;
    const city = (save.destinationCity ?? "").toLowerCase().trim();
    const key = `${title}|${city}`;

    const result = getEntityStatus({
      dayIndex: save.dayIndex,
      hasItineraryLink: save.hasItineraryLink,
      hasBooking: save.hasBooking,
      userRating: save.userRating,
      tripStatus: save.tripStatus,
      tripEndDate: save.tripEndDate,
    });

    if (map.has(key)) {
      const existing = map.get(key)!;
      const existingIdx = ENTITY_STATUSES.indexOf(existing.status);
      const newIdx = ENTITY_STATUSES.indexOf(result.status);
      if (newIdx > existingIdx) {
        map.set(key, result);
      }
    } else {
      map.set(key, result);
    }
  }

  return map;
}
