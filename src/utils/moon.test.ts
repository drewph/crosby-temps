import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildUsnoMoonPhasesUrl,
  fetchMoonPhaseOutlook,
  getDaysUntilNextFullMoon,
  getDateStringInTimeZone,
  getFallbackMoonPhase,
  getMoonPhaseNameFromDegrees,
  parseUsnoMoonPhaseEntry,
  parseUsnoMoonPhases,
  getNextFullMoonFromPhases
} from './moon';

const LOCATION = {
  latitude: 54.18031473227185,
  longitude: -4.54729408020627,
  timezone: 'Europe/London'
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('buildUsnoMoonPhasesUrl', () => {
  it('builds a USNO moon phases URL with a start date and number of phases', () => {
    const url = buildUsnoMoonPhasesUrl({ date: '2026-03-22', numPhases: 12 });

    expect(url.origin + url.pathname).toBe('https://aa.usno.navy.mil/api/moon/phases/date');
    expect(url.searchParams.get('date')).toBe('2026-03-22');
    expect(url.searchParams.get('nump')).toBe('12');
  });
});

describe('phase helpers', () => {
  it('formats Crosby dates in the configured timezone', () => {
    expect(getDateStringInTimeZone(new Date('2026-04-02T02:12:00Z'), LOCATION.timezone)).toBe('2026-04-02');
  });

  it('maps phase angles to readable labels', () => {
    expect(getMoonPhaseNameFromDegrees(0)).toBe('New Moon');
    expect(getMoonPhaseNameFromDegrees(90)).toBe('First Quarter');
    expect(getMoonPhaseNameFromDegrees(180)).toBe('Full Moon');
    expect(getMoonPhaseNameFromDegrees(270)).toBe('Last Quarter');
  });

  it('parses a USNO phase entry into a local-date summary', () => {
    const summary = parseUsnoMoonPhaseEntry(
      {
        phase: 'Full Moon',
        year: 2026,
        month: 4,
        day: 2,
        time: '02:12'
      },
      LOCATION.timezone
    );

    expect(summary?.isoDate).toBe('2026-04-02');
    expect(summary?.phase).toBe('Full Moon');
    expect(summary?.eventDate?.toISOString()).toBe('2026-04-02T02:12:00.000Z');
  });

  it('finds the next future full moon from the USNO response', () => {
    const phases = parseUsnoMoonPhases(
      {
        phasedata: [
          { phase: 'First Quarter', year: 2026, month: 3, day: 26, time: '15:00' },
          { phase: 'Full Moon', year: 2026, month: 4, day: 2, time: '02:12' },
          { phase: 'Full Moon', year: 2026, month: 5, day: 1, time: '11:30' }
        ]
      },
      LOCATION.timezone
    );

    const nextFullMoon = getNextFullMoonFromPhases(phases, new Date('2026-03-22T08:00:00Z'));

    expect(nextFullMoon?.isoDate).toBe('2026-04-02');
    expect(nextFullMoon?.eventDate?.toISOString()).toBe('2026-04-02T02:12:00.000Z');
  });
});

describe('fetchMoonPhaseOutlook', () => {
  it('uses the exact USNO full moon event so Crosby resolves to 2 April 2026', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        phasedata: [
          { phase: 'First Quarter', year: 2026, month: 3, day: 26, time: '15:00' },
          { phase: 'Full Moon', year: 2026, month: 4, day: 2, time: '02:12' },
          { phase: 'Last Quarter', year: 2026, month: 4, day: 9, time: '18:45' }
        ]
      })
    });

    vi.stubGlobal('fetch', fetchMock);

    const outlook = await fetchMoonPhaseOutlook(new Date('2026-03-22T08:00:00Z'), LOCATION);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0].toString()).toContain('date=2026-03-22');
    expect(outlook.source).toBe('api');
    expect(outlook.nextFullMoon?.isoDate).toBe('2026-04-02');
    expect(outlook.nextFullMoon?.eventDate?.toISOString()).toBe('2026-04-02T02:12:00.000Z');
    expect(getDaysUntilNextFullMoon(outlook.current, outlook.nextFullMoon)).toBe(11);
  });

  it('falls back to local calculations when the API fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const outlook = await fetchMoonPhaseOutlook(new Date('2026-03-22T08:00:00Z'), LOCATION);

    expect(outlook.source).toBe('fallback');
    expect(outlook.current.source).toBe('fallback');
    expect(outlook.nextFullMoon).toBeDefined();
  });

  it('produces a bounded fallback moon summary', () => {
    const phase = getFallbackMoonPhase(new Date('2026-03-22T08:00:00Z'), LOCATION.timezone);

    expect(phase.phase.length).toBeGreaterThan(0);
    expect(phase.illumination).toBeGreaterThanOrEqual(0);
    expect(phase.illumination).toBeLessThanOrEqual(1);
  });
});
