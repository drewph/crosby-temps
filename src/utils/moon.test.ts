import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addDaysToDateString,
  buildMetNoMoonUrl,
  fetchMoonPhaseOutlook,
  getDateRangeAround,
  getDaysUntilNextFullMoon,
  getDateStringInTimeZone,
  getFallbackMoonPhase,
  getMoonPhaseNameFromDegrees,
  getTimeZoneOffset,
  parseMetNoMoonResponse,
  pickClosestToFullMoon
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

describe('buildMetNoMoonUrl', () => {
  it('builds a MET Norway moon URL with Crosby coordinates and offset', () => {
    const url = buildMetNoMoonUrl({
      latitude: LOCATION.latitude,
      longitude: LOCATION.longitude,
      date: '2026-04-02',
      offset: '+01:00',
      timezone: LOCATION.timezone
    });

    expect(url.origin + url.pathname).toBe('https://api.met.no/weatherapi/sunrise/3.0/moon');
    expect(url.searchParams.get('lat')).toBe(LOCATION.latitude.toString());
    expect(url.searchParams.get('lon')).toBe(LOCATION.longitude.toString());
    expect(url.searchParams.get('date')).toBe('2026-04-02');
    expect(url.searchParams.get('offset')).toBe('+01:00');
  });
});

describe('timezone helpers', () => {
  it('formats Crosby dates in the configured timezone', () => {
    expect(getDateStringInTimeZone(new Date('2026-03-22T08:00:00Z'), LOCATION.timezone)).toBe('2026-03-22');
  });

  it('returns the correct offset across the BST transition', () => {
    expect(getTimeZoneOffset(new Date('2026-03-22T12:00:00Z'), LOCATION.timezone)).toBe('+00:00');
    expect(getTimeZoneOffset(new Date('2026-04-02T12:00:00Z'), LOCATION.timezone)).toBe('+01:00');
  });
});

describe('moon phase helpers', () => {
  it('maps phase angles to readable labels', () => {
    expect(getMoonPhaseNameFromDegrees(0)).toBe('New Moon');
    expect(getMoonPhaseNameFromDegrees(90)).toBe('First Quarter');
    expect(getMoonPhaseNameFromDegrees(180)).toBe('Full Moon');
    expect(getMoonPhaseNameFromDegrees(270)).toBe('Last Quarter');
  });

  it('parses the MET Norway response into app-friendly moon summaries', () => {
    const summary = parseMetNoMoonResponse(
      {
        properties: {
          moonphase: {
            value: 179.6
          }
        }
      },
      new Date('2026-04-02T12:00:00Z'),
      LOCATION.timezone
    );

    expect(summary.isoDate).toBe('2026-04-02');
    expect(summary.phase).toBe('Full Moon');
    expect(summary.illumination).toBeGreaterThan(0.999);
    expect(summary.phaseAngle).toBe(179.6);
    expect(summary.source).toBe('api');
  });

  it('builds a date window around an approximate full moon date', () => {
    expect(addDaysToDateString('2026-04-02', -1)).toBe('2026-04-01');
    expect(getDateRangeAround('2026-04-02', 2)).toEqual([
      '2026-03-31',
      '2026-04-01',
      '2026-04-02',
      '2026-04-03',
      '2026-04-04'
    ]);
  });

  it('picks the local date whose phase angle is closest to full moon', () => {
    const best = pickClosestToFullMoon([
      { isoDate: '2026-04-01', phase: 'Waxing Gibbous', illumination: 0.99, phaseAngle: 176.2, source: 'api' },
      { isoDate: '2026-04-02', phase: 'Full Moon', illumination: 1, phaseAngle: 179.6, source: 'api' },
      { isoDate: '2026-04-03', phase: 'Waning Gibbous', illumination: 0.98, phaseAngle: 184.8, source: 'api' }
    ]);

    expect(best?.isoDate).toBe('2026-04-02');
  });
});

describe('fetchMoonPhaseOutlook', () => {
  it('uses location-aware MET Norway data and selects the Crosby full-moon date', async () => {
    const fetchMock = vi.fn((input: string | URL) => {
      const url = new URL(input.toString());
      const date = url.searchParams.get('date');

      const values: Record<string, number> = {
        '2026-03-22': 126,
        '2026-03-31': 166.2,
        '2026-04-01': 176.9,
        '2026-04-02': 179.7,
        '2026-04-03': 192.4,
        '2026-04-04': 204.2
      };

      return Promise.resolve({
        ok: true,
        json: async () => ({
          properties: {
            moonphase: {
              value: values[date ?? '']
            }
          }
        })
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    const outlook = await fetchMoonPhaseOutlook(new Date('2026-03-22T08:00:00Z'), LOCATION);

    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(outlook.source).toBe('api');
    expect(outlook.current.isoDate).toBe('2026-03-22');
    expect(outlook.nextFullMoon?.isoDate).toBe('2026-04-02');
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

  it('keeps fallback parsing behavior when moonphase is missing', () => {
    const phase = parseMetNoMoonResponse({}, new Date('2026-03-22T08:00:00Z'), LOCATION.timezone);

    expect(phase.source).toBe('fallback');
    expect(phase.isoDate).toBe('2026-03-22');
  });

  it('produces a bounded fallback moon summary', () => {
    const phase = getFallbackMoonPhase(new Date('2026-03-22T08:00:00Z'), LOCATION.timezone);

    expect(phase.phase.length).toBeGreaterThan(0);
    expect(phase.illumination).toBeGreaterThanOrEqual(0);
    expect(phase.illumination).toBeLessThanOrEqual(1);
  });
});
