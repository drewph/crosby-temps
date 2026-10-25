import { describe, expect, it } from 'vitest';
import {
  buildSnapshotDocument,
  getYesterdayIso,
  listDateRange,
  mergeDays
} from './snapshot.mjs';

describe('getYesterdayIso', () => {
  it('uses the site timezone when the UTC date has already rolled over', () => {
    const lateEvening = new Date('2026-10-24T23:30:00Z');

    expect(getYesterdayIso(lateEvening, 'Europe/London')).toBe('2026-10-24');
    expect(getYesterdayIso(lateEvening, 'UTC')).toBe('2026-10-23');
  });

  it('crosses a year boundary', () => {
    expect(getYesterdayIso(new Date('2026-01-01T12:00:00Z'), 'Europe/London')).toBe('2025-12-31');
  });
});

describe('listDateRange', () => {
  it('includes both ends and handles a leap day', () => {
    expect(listDateRange('2028-02-28', '2028-03-01')).toEqual(['2028-02-28', '2028-02-29', '2028-03-01']);
  });

  it('returns an empty list for an inverted range', () => {
    expect(listDateRange('2026-10-03', '2026-10-01')).toEqual([]);
  });
});

describe('mergeDays', () => {
  const existing = {
    '2026-01-01': { maxC: 5.7, minC: 1.3, source: 'archive', recordedAt: '2026-01-02T06:00:00Z' },
    '2026-01-03': { maxC: 7.2, minC: 2.0, source: 'archive', recordedAt: '2026-01-04T06:00:00Z' }
  };

  const fetched = {
    '2026-01-01': { maxC: 9.9, minC: 8.8, source: 'archive', recordedAt: '2026-10-25T06:00:00Z' },
    '2026-01-02': { maxC: 6.1, minC: 0.4, source: 'archive', recordedAt: '2026-10-25T06:00:00Z' },
    '2026-01-04': { maxC: Number.NaN, minC: 3.3, source: 'archive', recordedAt: '2026-10-25T06:00:00Z' },
    '2026-01-05': { maxC: 11.0, minC: Number.POSITIVE_INFINITY, source: 'archive', recordedAt: '2026-10-25T06:00:00Z' }
  };

  it('adds only unrecorded days and never overwrites existing values', () => {
    const { days, added } = mergeDays(existing, fetched);

    expect(added).toBe(1);
    expect(days['2026-01-01'].maxC).toBe(5.7);
    expect(days['2026-01-02'].maxC).toBe(6.1);
    expect(days['2026-01-03'].maxC).toBe(7.2);
  });

  it('skips days with missing temperatures so a later run can fill them', () => {
    const { days } = mergeDays(existing, fetched);

    expect(days['2026-01-04']).toBeUndefined();
    expect(days['2026-01-05']).toBeUndefined();
  });

  it('returns dates in ascending order and is idempotent', () => {
    const first = mergeDays(existing, fetched);
    const second = mergeDays(first.days, fetched);

    expect(Object.keys(first.days)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
    expect(second.added).toBe(0);
    expect(second.days).toEqual(first.days);
  });
});

describe('buildSnapshotDocument', () => {
  it('wraps the days in a versioned document with the location and freeze policy', () => {
    const document = buildSnapshotDocument({
      '2026-01-02': { maxC: 6.1, minC: 0.4 },
      '2026-01-01': { maxC: 5.7, minC: 1.3 }
    });

    expect(document.schemaVersion).toBe(1);
    expect(document.location.label).toBe('Crosby, Isle of Man');
    expect(document.frozenPolicy).toBe('first-write');
    expect(Object.keys(document.days)).toEqual(['2026-01-01', '2026-01-02']);
  });
});
