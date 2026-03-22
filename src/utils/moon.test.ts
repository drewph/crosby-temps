import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildFarmSenseMoonUrl,
  fetchMoonPhaseOutlook,
  getDaysUntilNextFullMoon,
  getFallbackMoonPhase,
  getMoonPhaseOutlookFallback,
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
        isoDate: '2026-03-22',
        phase: 'Waxing Crescent',
        illumination: 0.31,
        ageDays: 6.1,
        source: 'api'
      }
    ]);
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

describe('getMoonPhaseOutlookFallback', () => {
  it('finds the next full moon from the fallback calculation', () => {
    const outlook = getMoonPhaseOutlookFallback(new Date('2026-03-22T00:00:00Z'));

    expect(outlook.current.isoDate).toBe('2026-03-22');
    expect(outlook.nextFullMoon).toBeDefined();
    expect(getDaysUntilNextFullMoon(outlook.current, outlook.nextFullMoon)).toBeGreaterThanOrEqual(0);
  });
});

describe('fetchMoonPhaseOutlook', () => {
  it('uses the API response when fetch succeeds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
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
            TargetDate: '1774872000',
            Phase: 'Full Moon',
            Illumination: 1,
            Age: 14.8
          }
        ]
      })
    );

    const outlook = await fetchMoonPhaseOutlook(new Date('2026-03-22T00:00:00Z'), 10);

    expect(outlook.source).toBe('api');
    expect(outlook.current.phase).toBe('Waxing Crescent');
    expect(outlook.nextFullMoon?.phase).toBe('Full Moon');
  });

  it('falls back to local calculations when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const outlook = await fetchMoonPhaseOutlook(new Date('2026-03-22T00:00:00Z'), 45);

    expect(outlook.source).toBe('fallback');
    expect(outlook.current.source).toBe('fallback');
    expect(outlook.nextFullMoon).toBeDefined();
  });
});
