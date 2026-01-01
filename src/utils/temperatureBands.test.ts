import { describe, expect, it } from 'vitest';
import { getTempPillColors } from './temperatureBands';

describe('getTempPillColors', () => {
  const cases = [
    { temp: -1, expected: { bg: '#0B1F5E', fg: '#FFFFFF' } },
    { temp: 0, expected: { bg: '#123C8B', fg: '#FFFFFF' } },
    { temp: 2, expected: { bg: '#123C8B', fg: '#FFFFFF' } },
    { temp: 3, expected: { bg: '#1E5AA8', fg: '#FFFFFF' } },
    { temp: 29, expected: { bg: '#F57C00', fg: '#102A43' } },
    { temp: 30, expected: { bg: '#E53935', fg: '#FFFFFF' } }
  ];

  it('returns the correct colours for band boundaries', () => {
    cases.forEach(({ temp, expected }) => {
      expect(getTempPillColors(temp)).toEqual(expected);
    });
  });

  it('uses the rounded temperature when selecting bands', () => {
    expect(getTempPillColors(2.6)).toEqual({ bg: '#1E5AA8', fg: '#FFFFFF' });
  });
});

