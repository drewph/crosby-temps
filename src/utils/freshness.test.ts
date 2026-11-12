import { describe, expect, it } from 'vitest';
import { Day } from '../types';
import { describeProvisionalTail, mergeFrozenWithLiveTail } from './freshness';

const day = (isoDate: string, maxC: number, minC: number): Day => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  return {
    isoDate,
    date,
    monthKey: isoDate.slice(0, 7),
    dayOfMonth: date.getUTCDate(),
    maxC,
    minC
  };
};

describe('mergeFrozenWithLiveTail', () => {
  it('keeps the frozen value when the live archive disagrees', () => {
    const frozen = [day('2026-11-10', 9.7, 4.9)];
    const live = [day('2026-11-10', 9.9, 5.1)];

    const { days } = mergeFrozenWithLiveTail(frozen, live);

    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({ isoDate: '2026-11-10', maxC: 9.7, minC: 4.9, provisional: false });
  });

  it('flags only the dates the snapshot has not frozen', () => {
    const frozen = [day('2026-11-09', 9.7, 4.9), day('2026-11-10', 8.6, 6.9)];
    const live = [
      day('2026-11-09', 9.7, 4.9),
      day('2026-11-10', 8.6, 6.9),
      day('2026-11-11', 9.2, 4.5)
    ];

    const { days, provisionalDates } = mergeFrozenWithLiveTail(frozen, live);

    expect(provisionalDates).toEqual(['2026-11-11']);
    expect(days.map((entry) => entry.isoDate)).toEqual(['2026-11-09', '2026-11-10', '2026-11-11']);
    expect(days[2]).toMatchObject({ maxC: 9.2, minC: 4.5, provisional: true });
  });

  it('treats every live day as provisional when no snapshot exists', () => {
    const { days, provisionalDates } = mergeFrozenWithLiveTail([], [day('2026-11-11', 9.2, 4.5)]);

    expect(days).toHaveLength(1);
    expect(provisionalDates).toEqual(['2026-11-11']);
  });

  it('falls back to the snapshot when the live archive returns nothing', () => {
    const frozen = [day('2026-11-10', 8.6, 6.9)];
    const { days, provisionalDates } = mergeFrozenWithLiveTail(frozen, []);

    expect(days).toHaveLength(1);
    expect(provisionalDates).toEqual([]);
  });

  it('sorts mixed input and keeps interior gaps provisional', () => {
    const frozen = [day('2026-10-31', 12.3, 8.3)];
    const live = [day('2026-11-02', 10.8, 5.1), day('2026-11-01', 11.8, 6.9)];

    const { days, provisionalDates } = mergeFrozenWithLiveTail(frozen, live);

    expect(days.map((entry) => entry.isoDate)).toEqual(['2026-10-31', '2026-11-01', '2026-11-02']);
    expect(provisionalDates).toEqual(['2026-11-01', '2026-11-02']);
  });
});

describe('describeProvisionalTail', () => {
  const formatDate = (isoDate: string) => isoDate.slice(5).replace('-', '/');

  it('returns nothing without provisional dates', () => {
    expect(describeProvisionalTail([], formatDate)).toBe('');
  });

  it('uses the singular for one day', () => {
    expect(describeProvisionalTail(['2026-11-11'], formatDate)).toBe(
      'Provisional: 11/11 is from the live archive and may still change until the 06:15 UTC snapshot freezes it.'
    );
  });

  it('lists a short tail in date order', () => {
    expect(describeProvisionalTail(['2026-11-11', '2026-11-10'], formatDate)).toBe(
      'Provisional: 11/10 and 11/11 are from the live archive and may still change until the 06:15 UTC snapshot freezes them.'
    );
  });

  it('summarises longer tails', () => {
    expect(describeProvisionalTail(['2026-11-09', '2026-11-10', '2026-11-11'], formatDate)).toBe(
      'Provisional: 11/09, 11/10 and 1 more are from the live archive and may still change until the 06:15 UTC snapshot freezes them.'
    );
  });
});
