import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { formatDate, getLastNDaysRange, getYesterday } from './dateRanges';

const SYSTEM_TIME = new Date('2024-06-15T10:00:00Z');
const TIMEZONE = 'Europe/London';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(SYSTEM_TIME);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('getYesterday', () => {
  it('returns the previous calendar day at midnight', () => {
    const yesterday = getYesterday(TIMEZONE);
    expect(formatDate(yesterday)).toBe('2024-06-14');
    expect(yesterday.getUTCHours()).toBe(0);
    expect(yesterday.getUTCMinutes()).toBe(0);
    expect(yesterday.getUTCSeconds()).toBe(0);
    expect(yesterday.getUTCMilliseconds()).toBe(0);
  });
});

describe('getLastNDaysRange', () => {
  it('returns a 7 day range ending yesterday with the correct start', () => {
    const range = getLastNDaysRange(7, TIMEZONE);
    expect(formatDate(range.end)).toBe('2024-06-14');
    expect(formatDate(range.start)).toBe('2024-06-08');
  });

  it('returns a 30 day range ending yesterday with the correct start', () => {
    const range = getLastNDaysRange(30, TIMEZONE);
    expect(formatDate(range.end)).toBe('2024-06-14');
    expect(formatDate(range.start)).toBe('2024-05-16');
  });

  it('throws when days is less than 1', () => {
    expect(() => getLastNDaysRange(0)).toThrowError('Days must be at least 1');
  });
});
