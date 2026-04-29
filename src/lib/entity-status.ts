export const ENTITY_STATUSES = ['saved', 'on_itinerary', 'booked', 'completed', 'rated'] as const
export type EntityStatus = typeof ENTITY_STATUSES[number]

export interface EntityStatusInput {
  dayIndex: number | null
  hasItineraryLink: boolean
  hasBooking: boolean
  userRating: number | null
  tripStatus: string | null
  tripEndDate: string | null  // ISO date string
}

export interface EntityStatusResult {
  status: EntityStatus
  label: string
  color: string         // hex, '' when no pill
  showAffordance: boolean
}

export function getEntityStatus(input: EntityStatusInput): EntityStatusResult {
  const { userRating, tripStatus, tripEndDate, hasBooking, dayIndex, hasItineraryLink } = input

  // 1. Rated
  if (userRating != null) {
    return { status: 'rated', label: `Rated ${userRating}★`, color: '#FBBF24', showAffordance: false }
  }

  // 2. Booked
  if (hasBooking) {
    return { status: 'booked', label: 'Booked', color: '#C4664A', showAffordance: false }
  }

  // 3. On itinerary — dayIndex covers user-assigned saves; hasItineraryLink covers email-extracted bookings
  if (dayIndex != null || hasItineraryLink) {
    return { status: 'on_itinerary', label: 'On itinerary', color: '#16A34A', showAffordance: false }
  }

  // 4. Saved (default)
  // Discipline 4.11 + 4.6 defense-in-depth: trip-level completion does not cascade to items.
  // Engaged items (rated, booked, on-itinerary) return from branches 1–3. Unengaged items on
  // past/completed trips stay at 'Saved' — trip calendar state is not evidence the user visited.
  return { status: 'saved', label: '', color: '', showAffordance: true }
}
