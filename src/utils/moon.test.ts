import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getDaysUntilNextFullMoon,
  getMoonPhase,
  getMoonPhaseOutlook,
  getNextFullMoon,
  getPhaseNameFromAge
} from './moon';

const SYNODIC_MONTH_DAYS = 29.530588853;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getPhaseNameFromAge', () => {
  it.each([
    [0, 'New Moon'],
    [0.4, 'New Moon'],
    [SYNODIC_MONTH_DAYS - 0.3, 'New Moon'],
    [1.5, 'Waxing Crescent'],
    [SYNODIC_MONTH_DAYS / 4, 'First Quarter'],
    [SYNODIC_MONTH_DAYS / 4 + 0.3, 'First Quarter'],
    [SYNODIC_MONTH_DAYS / 4 + 1, 'Waxing Gibbous'],
    [SYNODIC_MONTH_DAYS / 2 - 0.4, 'Full Moon'],
    [SYNODIC_MONTH_DAYS / 2, 'Full Moon'],
    [SYNODIC_MONTH_DAYS / 2 + 0.6, 'Waning Gibbous'],
    [(SYNODIC_MONTH_DAYS * 3) / 4, 'Last Quarter'],
    [(SYNODIC_MONTH_DAYS * 3) / 4 + 0.6, 'Waning Crescent']
  ])('names an age of %s days as %s', (ageDays, expected) => {
    expect(getPhaseNameFromAge(ageDays)).toBe(expected);
  });

  it('only uses the full moon label near the full moon itself', () => {
    expect(getPhaseNameFromAge(SYNODIC_MONTH_DAYS / 2 - 2)).toBe('Waxing Gibbous');
    expect(getPhaseNameFromAge(SYNODIC_MONTH_DAYS / 2 + 2)).toBe('Waning Gibbous');
  });
});

describe('getMoonPhase', () => {
  it('reports a waxing gibbous moon two days before the October 2026 full moon', () => {
    const phase = getMoonPhase(new Date('2026-10-24T12:00:00Z'));

    expect(phase.phase).toBe('Waxing Gibbous');
    expect(phase.illumination).toBeGreaterThan(0.95);
    expect(phase.illumination).toBeLessThan(1);
  });

  it('reports the full moon on 26 October 2026', () => {
    const phase = getMoonPhase(new Date('2026-10-26T03:35:00Z'));

    expect(phase.phase).toBe('Full Moon');
    expect(phase.illumination).toBeGreaterThan(0.99);
  });
});

describe('getNextFullMoon', () => {
  it('returns the October 2026 full moon from 24 October', () => {
    const nextFullMoon = getNextFullMoon(new Date('2026-10-24T12:00:00Z'));

    expect(nextFullMoon.phase).toBe('Full Moon');
    expect(new Date(nextFullMoon.timestampMs).toISOString().slice(0, 10)).toBe('2026-10-26');
  });

  it('returns a future event on 2 April 2026 for the April 2026 regression', () => {
    const nextFullMoon = getNextFullMoon(new Date('2026-03-22T00:00:00Z'));

    expect(new Date(nextFullMoon.timestampMs).toISOString().slice(0, 10)).toBe('2026-04-02');
  });
});

describe('getDaysUntilNextFullMoon', () => {
  it('counts two days from 24 October to the full moon', () => {
    const today = new Date('2026-10-24T12:00:00Z');
    const nextFullMoon = getNextFullMoon(today);

    expect(getDaysUntilNextFullMoon(today, nextFullMoon, 'Europe/London')).toBe(2);
  });
});

describe('getMoonPhaseOutlook', () => {
  it('builds the outlook from local calculations without any network request', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const outlook = getMoonPhaseOutlook(new Date('2026-10-24T12:00:00Z'), 'Europe/London');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(outlook.current.phase).toBe('Waxing Gibbous');
    expect(getDaysUntilNextFullMoon(new Date('2026-10-24T12:00:00Z'), outlook.nextFullMoon, 'Europe/London')).toBe(2);
  });

  it('anchors the current phase to the site timezone', () => {
    const outlook = getMoonPhaseOutlook(new Date('2026-10-24T23:30:00Z'), 'Europe/London');

    expect(outlook.current.isoDate).toBe('2026-10-25');
  });
});
