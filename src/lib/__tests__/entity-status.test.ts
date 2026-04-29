import { describe, it, expect } from 'vitest'
import { getEntityStatus } from '../entity-status'

const base = {
  dayIndex: null,
  hasItineraryLink: false,
  hasBooking: false,
  userRating: null,
  tripStatus: null,
  tripEndDate: null,
}

describe('getEntityStatus', () => {
  it('default (no signals) → saved, showAffordance true', () => {
    const r = getEntityStatus(base)
    expect(r.status).toBe('saved')
    expect(r.showAffordance).toBe(true)
    expect(r.color).toBe('')
    expect(r.label).toBe('')
  })

  it('dayIndex set → on_itinerary (Cape Manzamo simulation)', () => {
    const r = getEntityStatus({ ...base, dayIndex: 3 })
    expect(r.status).toBe('on_itinerary')
    expect(r.label).toBe('On itinerary')
    expect(r.color).toBe('#16A34A')
    expect(r.showAffordance).toBe(false)
  })

  it('hasItineraryLink without dayIndex → on_itinerary', () => {
    const r = getEntityStatus({ ...base, hasItineraryLink: true })
    expect(r.status).toBe('on_itinerary')
    expect(r.showAffordance).toBe(false)
  })

  it('hasBooking → booked, overrides on_itinerary (Hyatt simulation)', () => {
    // Hyatt: dayIndex null, hasItineraryLink true, hasBooking true
    const r = getEntityStatus({ ...base, dayIndex: null, hasItineraryLink: true, hasBooking: true })
    expect(r.status).toBe('booked')
    expect(r.label).toBe('Booked')
    expect(r.color).toBe('#C4664A')
    expect(r.showAffordance).toBe(false)
  })

  it('hasBooking alone → booked', () => {
    const r = getEntityStatus({ ...base, hasBooking: true })
    expect(r.status).toBe('booked')
    expect(r.showAffordance).toBe(false)
  })

  it('tripStatus COMPLETED, no engagement → saved (Discipline 4.11: trip calendar ≠ user visited)', () => {
    const r = getEntityStatus({ ...base, tripStatus: 'COMPLETED' })
    expect(r.status).toBe('saved')
    expect(r.showAffordance).toBe(true)
  })

  it('tripEndDate in past, no engagement → saved', () => {
    const r = getEntityStatus({ ...base, tripEndDate: '2024-01-01T00:00:00.000Z' })
    expect(r.status).toBe('saved')
    expect(r.showAffordance).toBe(true)
  })

  it('userRating set → rated, highest priority', () => {
    // rated beats everything including hasBooking
    const r = getEntityStatus({ ...base, userRating: 4, hasBooking: true, tripStatus: 'COMPLETED' })
    expect(r.status).toBe('rated')
    expect(r.label).toBe('Rated 4★')
    expect(r.color).toBe('#FBBF24')
    expect(r.showAffordance).toBe(false)
  })

  it('booked beats completed trip — engagement label wins over calendar state', () => {
    const r = getEntityStatus({ ...base, hasBooking: true, tripStatus: 'COMPLETED' })
    expect(r.status).toBe('booked')
  })

  it('on_itinerary beats completed trip — engagement label wins over calendar state', () => {
    const r = getEntityStatus({ ...base, dayIndex: 2, tripStatus: 'COMPLETED' })
    expect(r.status).toBe('on_itinerary')
  })

  it('tripEndDate in future → saved (not affected)', () => {
    const r = getEntityStatus({ ...base, tripEndDate: '2099-01-01T00:00:00.000Z' })
    expect(r.status).toBe('saved')
    expect(r.showAffordance).toBe(true)
  })

  it('booked beats on_itinerary', () => {
    const r = getEntityStatus({ ...base, dayIndex: 2, hasBooking: true })
    expect(r.status).toBe('booked')
  })
})
