import { describe, expect, it } from 'vitest';
import { findMissingDates } from './dataQuality';

const range = (start: string, end: string) => ({ start: new Date(`${start}T00:00:00Z`), end: new Date(`${end}T00:00:00Z`) });

describe('findMissingDates', () => {
  it('returns nothing when every day in the range is present', () => {
    const { start, end } = range('2026-10-17', '2026-10-23');
    const received = ['2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23'];

    expect(findMissingDates(start, end, received)).toEqual([]);
  });

  it('finds interior and trailing gaps', () => {
    const { start, end } = range('2026-10-17', '2026-10-23');
    const received = ['2026-10-17', '2026-10-19', '2026-10-20'];

    expect(findMissingDates(start, end, received)).toEqual(['2026-10-18', '2026-10-21', '2026-10-22', '2026-10-23']);
  });

  it('spans month boundaries', () => {
    const { start, end } = range('2026-10-30', '2026-11-02');

    expect(findMissingDates(start, end, ['2026-10-31'])).toEqual(['2026-10-30', '2026-11-01', '2026-11-02']);
  });

  it('ignores dates outside the requested range', () => {
    const { start, end } = range('2026-10-17', '2026-10-18');

    expect(findMissingDates(start, end, ['2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19'])).toEqual([]);
  });

  it('returns an empty list for an inverted range', () => {
    expect(findMissingDates(new Date('2026-10-23T00:00:00Z'), new Date('2026-10-17T00:00:00Z'), [])).toEqual([]);
  });
});
