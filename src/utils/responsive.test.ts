import { describe, expect, it } from 'vitest';
import { COMPACT_CALENDAR_QUERY, isCompactCalendar } from './responsive';

type StubMediaQueryList = Pick<MediaQueryList, 'matches'>;

describe('isCompactCalendar', () => {
  it('returns true when the media query matches', () => {
    const stubMatchMedia = (query: string): StubMediaQueryList => {
      expect(query).toBe(COMPACT_CALENDAR_QUERY);
      return { matches: true };
    };

    expect(isCompactCalendar(stubMatchMedia as unknown as typeof window.matchMedia)).toBe(true);
  });

  it('returns false when the media query does not match', () => {
    const stubMatchMedia = (query: string): StubMediaQueryList => {
      expect(query).toBe(COMPACT_CALENDAR_QUERY);
      return { matches: false };
    };

    expect(isCompactCalendar(stubMatchMedia as unknown as typeof window.matchMedia)).toBe(false);
  });
});
