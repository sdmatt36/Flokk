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

  // 2. Completed
  const isCompleted =
    tripStatus === 'COMPLETED' ||
    (tripEndDate != null && new Date(tripEndDate) < new Date())
  if (isCompleted) {
    return { status: 'completed', label: 'Completed', color: '#9CA3AF', showAffordance: false }
  }

  // 3. Booked
  if (hasBooking) {
    return { status: 'booked', label: 'Booked', color: '#C4664A', showAffordance: false }
  }

  // 4. On itinerary — dayIndex covers user-assigned saves; hasItineraryLink covers email-extracted bookings
  if (dayIndex != null || hasItineraryLink) {
    return { status: 'on_itinerary', label: 'On itinerary', color: '#16A34A', showAffordance: false }
  }

  // 5. Saved (default)
  return { status: 'saved', label: '', color: '', showAffordance: true }
}
