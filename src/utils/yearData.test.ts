import { describe, expect, it } from 'vitest';
import { getYearDateRange, snapshotToDailyResponse } from './yearData';

describe('snapshotToDailyResponse', () => {
  it('sorts dates and skips entries without both temperatures', () => {
    const daily = snapshotToDailyResponse({
      days: {
        '2026-01-03': { maxC: 7.2, minC: 2 },
        '2026-01-01': { maxC: 5.7, minC: 1.3 },
        '2026-01-02': { maxC: null, minC: 0.4 },
        '2026-01-04': { maxC: 9 }
      }
    });

    expect(daily).toEqual({
      time: ['2026-01-01', '2026-01-03'],
      temperature_2m_max: [5.7, 7.2],
      temperature_2m_min: [1.3, 2]
    });
  });

  it('returns undefined for an empty or malformed payload', () => {
    expect(snapshotToDailyResponse({})).toBeUndefined();
    expect(snapshotToDailyResponse({ days: {} })).toBeUndefined();
    expect(snapshotToDailyResponse({ days: { '2026-01-01': {} } })).toBeUndefined();
  });
});

describe('getYearDateRange', () => {
  it('stops the current year at yesterday', () => {
    expect(getYearDateRange(2026, '2026-10-24')).toEqual({
      startDate: '2026-01-01',
      endDate: '2026-10-24'
    });
  });

  it('covers a whole past year', () => {
    expect(getYearDateRange(2025, '2026-10-24')).toEqual({
      startDate: '2025-01-01',
      endDate: '2025-12-31'
    });
  });

  it('returns no end date for a future year', () => {
    expect(getYearDateRange(2027, '2026-10-24')).toEqual({
      startDate: '2027-01-01',
      endDate: ''
    });
  });
});
