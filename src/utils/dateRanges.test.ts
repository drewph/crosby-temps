import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { formatDate, getLastNDaysRange, getYesterday } from './dateRanges';

const SYSTEM_TIME = new Date('2024-06-15T10:00:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(SYSTEM_TIME);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('getYesterday', () => {
  it('returns the previous calendar day at midnight', () => {
    const yesterday = getYesterday();
    expect(formatDate(yesterday)).toBe('2024-06-14');
    expect(yesterday.getHours()).toBe(0);
    expect(yesterday.getMinutes()).toBe(0);
    expect(yesterday.getSeconds()).toBe(0);
    expect(yesterday.getMilliseconds()).toBe(0);
  });
});

describe('getLastNDaysRange', () => {
  it('returns a range ending yesterday with the correct start', () => {
    const range = getLastNDaysRange(7);
    expect(formatDate(range.end)).toBe('2024-06-14');
    expect(formatDate(range.start)).toBe('2024-06-08');
  });

  it('throws when days is less than 1', () => {
    expect(() => getLastNDaysRange(0)).toThrowError('Days must be at least 1');
  });
});
