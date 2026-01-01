import { describe, expect, it } from 'vitest';
import { formatDateWithWeekday, formatLastUpdated, formatTemperature } from './formatters';

describe('formatDateWithWeekday', () => {
  it('returns the weekday and date string using the provided timezone', () => {
    const formatted = formatDateWithWeekday('2025-12-28', 'Europe/London');
    expect(formatted).toEqual({
      weekday: 'Sunday',
      date: '2025-12-28'
    });
  });

  it('calculates the weekday based on the supplied timezone', () => {
    const formatted = formatDateWithWeekday('2024-03-31', 'Europe/London');
    expect(formatted.weekday).toBe('Sunday');
    expect(formatted.date).toBe('2024-03-31');
  });
});

describe('formatLastUpdated', () => {
  it('returns a non-empty, formatted timestamp string', () => {
    const formatted = formatLastUpdated(new Date('2026-01-01T10:42:00Z'), 'Europe/London');
    expect(formatted.length).toBeGreaterThan(0);
  });
});

describe('formatTemperature', () => {
  it('rounds to the nearest whole number with no decimals', () => {
    expect(formatTemperature(12.6)).toBe('13');
    expect(formatTemperature(12.4)).toBe('12');
    expect(formatTemperature(-1.6)).toBe('-2');
    expect(formatTemperature(-1.4)).toBe('-1');
  });

  it('returns zero instead of negative zero', () => {
    expect(formatTemperature(-0.4)).toBe('0');
    expect(formatTemperature(-0.1)).toBe('0');
  });

  it('returns a dash for non-numeric values', () => {
    expect(formatTemperature(Number.NaN)).toBe('–');
    expect(formatTemperature(Number.POSITIVE_INFINITY)).toBe('–');
  });
});
