import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildFarmSenseMoonUrl,
  fetchMoonPhaseOutlook,
  findClosestFullMoonPhase,
  getDaysUntilNextFullMoon,
  getFallbackMoonPhase,
  getMoonPhaseOutlookFallback,
  getNextFullMoon,
  getUnixTimestampsForNextDays,
  parseFarmSenseMoonPhases
} from './moon';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('buildFarmSenseMoonUrl', () => {
  it('builds a moon phase URL with one d[] parameter per timestamp', () => {
    const url = buildFarmSenseMoonUrl({ timestamps: [1719273600, 1719360000] });

    expect(url.origin + url.pathname).toBe('https://api.farmsense.net/v1/moonphases/');
    expect(url.searchParams.getAll('d[]')).toEqual(['1719273600', '1719360000']);
  });
});

describe('getUnixTimestampsForNextDays', () => {
  it('returns one midday UTC timestamp per day', () => {
    const timestamps = getUnixTimestampsForNextDays(new Date('2026-03-22T08:00:00Z'), 3);

    expect(timestamps).toEqual([1774180800, 1774267200, 1774353600]);
  });

  it('anchors the lookup window to the site timezone instead of UTC', () => {
    const timestamps = getUnixTimestampsForNextDays(new Date('2026-04-01T23:30:00Z'), 2, 'Europe/London');

    expect(timestamps).toEqual([1775131200, 1775217600]);
  });
});

describe('parseFarmSenseMoonPhases', () => {
  it('normalizes the API response into app-friendly moon summaries', () => {
    const phases = parseFarmSenseMoonPhases([
      {
        Error: 0,
        TargetDate: '1774180800',
        Phase: 'Waxing Cresent',
        Illumination: 0.31,
        Age: 6.1
      }
    ]);

    expect(phases).toEqual([
      {
        timestampMs: 1774180800000,
        isoDate: '2026-03-22',
        phase: 'Waxing Crescent',
        illumination: 0.31,
        ageDays: 6.1,
        source: 'api'
      }
    ]);
  });
});

describe('findClosestFullMoonPhase', () => {
  it.each([
    {
      name: 'April 2026 regression window',
      phases: [
        { timestampMs: Date.parse('2026-04-01T23:00:00Z'), isoDate: '2026-04-01', phase: 'Waxing Gibbous', illumination: 0.996, ageDays: 14.5, source: 'api' as const },
        { timestampMs: Date.parse('2026-04-02T02:00:00Z'), isoDate: '2026-04-02', phase: 'Full Moon', illumination: 1, ageDays: 14.76, source: 'api' as const },
        { timestampMs: Date.parse('2026-04-02T05:00:00Z'), isoDate: '2026-04-02', phase: 'Full Moon', illumination: 0.999, ageDays: 14.9, source: 'api' as const }
      ],
      expectedIsoDate: '2026-04-02'
    },
    {
      name: 'later future full moon window',
      phases: [
        { timestampMs: Date.parse('2026-08-27T15:00:00Z'), isoDate: '2026-08-27', phase: 'Waxing Gibbous', illumination: 0.997, ageDays: 14.6, source: 'api' as const },
        { timestampMs: Date.parse('2026-08-27T19:00:00Z'), isoDate: '2026-08-27', phase: 'Full Moon', illumination: 1, ageDays: 14.77, source: 'api' as const },
        { timestampMs: Date.parse('2026-08-27T23:00:00Z'), isoDate: '2026-08-27', phase: 'Full Moon', illumination: 0.998, ageDays: 14.93, source: 'api' as const }
      ],
      expectedIsoDate: '2026-08-27'
    }
  ])('picks the peak illumination sample for $name', ({ phases, expectedIsoDate }) => {
    const result = findClosestFullMoonPhase(phases);

    expect(result?.isoDate).toBe(expectedIsoDate);
  });
});

describe('getFallbackMoonPhase', () => {
  it('calculates a fallback phase and illumination', () => {
    const phase = getFallbackMoonPhase(new Date('2026-03-22T00:00:00Z'));

    expect(phase.isoDate).toBe('2026-03-22');
    expect(phase.phase.length).toBeGreaterThan(0);
    expect(phase.illumination).toBeGreaterThanOrEqual(0);
    expect(phase.illumination).toBeLessThanOrEqual(1);
    expect(phase.source).toBe('fallback');
  });
});

describe('getNextFullMoon', () => {
  it('returns a future fallback event on 2 April 2026 for the April 2026 regression', () => {
    const nextFullMoon = getNextFullMoon(new Date('2026-03-22T00:00:00Z'));

    expect(nextFullMoon.phase).toBe('Full Moon');
    expect(new Date(nextFullMoon.timestampMs).toISOString().slice(0, 10)).toBe('2026-04-02');
  });
});

describe('getMoonPhaseOutlookFallback', () => {
  it('finds the next full moon from the fallback calculation', () => {
    const outlook = getMoonPhaseOutlookFallback(new Date('2026-03-22T00:00:00Z'));

    expect(outlook.current.isoDate).toBe('2026-03-22');
    expect(outlook.nextFullMoon).toBeDefined();
    expect(getDaysUntilNextFullMoon(new Date('2026-03-22T00:00:00Z'), outlook.nextFullMoon)).toBeGreaterThanOrEqual(0);
  });
});

describe('fetchMoonPhaseOutlook', () => {
  it('refines the next full moon from API samples so the April 2026 result lands on 2 April', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            {
              Error: 0,
              TargetDate: '1774267200',
              Phase: 'Waxing Cresent',
              Illumination: 0.44,
              Age: 7.4
            },
            {
              Error: 0,
              TargetDate: '1775044800',
              Phase: 'Full Moon',
              Illumination: 0.99,
              Age: 14.6
            }
          ]
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            {
              Error: 0,
              TargetDate: `${Date.parse('2026-04-01T23:00:00Z') / 1000}`,
              Phase: 'Waxing Gibbous',
              Illumination: 0.996,
              Age: 14.5
            },
            {
              Error: 0,
              TargetDate: `${Date.parse('2026-04-02T02:00:00Z') / 1000}`,
              Phase: 'Full Moon',
              Illumination: 1,
              Age: 14.76
            },
            {
              Error: 0,
              TargetDate: `${Date.parse('2026-04-02T05:00:00Z') / 1000}`,
              Phase: 'Full Moon',
              Illumination: 0.999,
              Age: 14.9
            }
          ]
        })
    );

    const outlook = await fetchMoonPhaseOutlook(new Date('2026-03-22T00:00:00Z'), 10, 'Europe/London');

    expect(outlook.source).toBe('api');
    expect(outlook.current.phase).toBe('Waxing Crescent');
    expect(outlook.nextFullMoon.source).toBe('api');
    expect(new Date(outlook.nextFullMoon.timestampMs).toISOString().slice(0, 10)).toBe('2026-04-02');
  });

  it('falls back to the calculated full moon event if refinement fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            {
              Error: 0,
              TargetDate: '1774267200',
              Phase: 'Waxing Cresent',
              Illumination: 0.44,
              Age: 7.4
            },
            {
              Error: 0,
              TargetDate: '1775044800',
              Phase: 'Full Moon',
              Illumination: 0.99,
              Age: 14.6
            }
          ]
        })
        .mockResolvedValueOnce({ ok: false, status: 503 })
    );
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const outlook = await fetchMoonPhaseOutlook(new Date('2026-03-22T00:00:00Z'), 45, 'Europe/London');

    expect(outlook.source).toBe('api');
    expect(outlook.nextFullMoon.source).toBe('calculated');
    expect(new Date(outlook.nextFullMoon.timestampMs).toISOString().slice(0, 10)).toBe('2026-04-02');
  });

  it('falls back to local calculations when the API request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const outlook = await fetchMoonPhaseOutlook(new Date('2026-03-22T00:00:00Z'), 45, 'Europe/London');

    expect(outlook.source).toBe('fallback');
    expect(outlook.current.source).toBe('fallback');
    expect(outlook.nextFullMoon.source).toBe('calculated');
  });
});
