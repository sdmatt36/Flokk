import { describe, it, expect } from 'vitest'
import { getTripPhase, bucketTrips } from '../trip-phase'

const past = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
};
const future = (daysAhead: number) => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString();
};
const now = () => new Date().toISOString();

describe('getTripPhase', () => {
  it('trip entirely in past → "past"', () => {
    expect(getTripPhase({ startDate: past(10), endDate: past(3) })).toBe('past');
  });

  it('trip entirely in future → "upcoming"', () => {
    expect(getTripPhase({ startDate: future(5), endDate: future(10) })).toBe('upcoming');
  });

  it('trip currently in progress (startDate past, endDate future) → "current"', () => {
    expect(getTripPhase({ startDate: past(3), endDate: future(3) })).toBe('current');
  });

  it('trip starting today (startDate near-now, endDate future) → "current"', () => {
    const justNow = new Date(Date.now() - 60_000).toISOString(); // 1 min ago
    expect(getTripPhase({ startDate: justNow, endDate: future(5) })).toBe('current');
  });

  it('trip ending today (startDate past, endDate near-now) → "current"', () => {
    const inOneMin = new Date(Date.now() + 60_000).toISOString();
    expect(getTripPhase({ startDate: past(5), endDate: inOneMin })).toBe('current');
  });

  it('null startDate → "upcoming"', () => {
    expect(getTripPhase({ startDate: null, endDate: future(5) })).toBe('upcoming');
  });

  it('null endDate → "upcoming"', () => {
    expect(getTripPhase({ startDate: past(3), endDate: null })).toBe('upcoming');
  });

  it('both null → "upcoming"', () => {
    expect(getTripPhase({ startDate: null, endDate: null })).toBe('upcoming');
  });

  it('accepts Date objects as well as strings', () => {
    expect(getTripPhase({ startDate: new Date(past(3)), endDate: new Date(future(3)) })).toBe('current');
    expect(getTripPhase({ startDate: new Date(past(10)), endDate: new Date(past(3)) })).toBe('past');
    expect(getTripPhase({ startDate: new Date(future(3)), endDate: new Date(future(10)) })).toBe('upcoming');
  });
});

describe('bucketTrips', () => {
  it('distributes mixed trips into correct buckets', () => {
    const trips = [
      { id: 'a', startDate: past(10), endDate: past(3) },   // past
      { id: 'b', startDate: future(5), endDate: future(10) }, // upcoming
      { id: 'c', startDate: past(3), endDate: future(3) },  // current
      { id: 'd', startDate: null, endDate: null },           // upcoming (null)
    ];
    const { current, upcoming, past: pastBucket } = bucketTrips(trips);
    expect(current.map(t => t.id)).toEqual(['c']);
    expect(upcoming.map(t => t.id)).toContain('b');
    expect(upcoming.map(t => t.id)).toContain('d');
    expect(pastBucket.map(t => t.id)).toEqual(['a']);
  });

  it('current sorted by endDate ascending (soonest-ending first)', () => {
    const trips = [
      { id: 'long', startDate: past(5), endDate: future(20) },
      { id: 'short', startDate: past(2), endDate: future(3) },
    ];
    const { current } = bucketTrips(trips);
    expect(current[0].id).toBe('short');
    expect(current[1].id).toBe('long');
  });

  it('upcoming sorted by startDate ascending', () => {
    const trips = [
      { id: 'later', startDate: future(20), endDate: future(25) },
      { id: 'soon', startDate: future(5), endDate: future(10) },
    ];
    const { upcoming } = bucketTrips(trips);
    expect(upcoming[0].id).toBe('soon');
    expect(upcoming[1].id).toBe('later');
  });

  it('past sorted by endDate descending (most recently ended first)', () => {
    const trips = [
      { id: 'older', startDate: past(30), endDate: past(20) },
      { id: 'recent', startDate: past(10), endDate: past(3) },
    ];
    const { past: pastBucket } = bucketTrips(trips);
    expect(pastBucket[0].id).toBe('recent');
    expect(pastBucket[1].id).toBe('older');
  });

  it('empty input produces empty buckets', () => {
    const { current, upcoming, past: pastBucket } = bucketTrips([]);
    expect(current).toHaveLength(0);
    expect(upcoming).toHaveLength(0);
    expect(pastBucket).toHaveLength(0);
  });
});
