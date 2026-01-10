import { describe, expect, it } from 'vitest';
import { getTempPillColors } from './temperatureBands';

describe('getTempPillColors', () => {
  const cases = [
    { temp: -1, expected: '#5B2A86' },
    { temp: 0, expected: '#5B2A86' },
    { temp: 1, expected: '#1E3A8A' },
    { temp: 2, expected: '#1E3A8A' },
    { temp: 3, expected: '#3B82F6' },
    { temp: 10, expected: '#34D399' },
    { temp: 12, expected: '#F4C542' },
    { temp: 14, expected: '#F4A3C0' },
    { temp: 22, expected: '#D08A95' },
    { temp: 24, expected: '#7A3DBA' },
    { temp: 26, expected: '#E23B3B' },
    { temp: 28, expected: '#8B1E2D' },
    { temp: 29, expected: '#5A0B16' }
  ];

  it('returns the correct colours for band boundaries', () => {
    cases.forEach(({ temp, expected }) => {
      expect(getTempPillColors(temp).bg).toBe(expected);
    });
  });

  it('uses the rounded temperature when selecting bands', () => {
    expect(getTempPillColors(10.5).bg).toBe('#F4C542');
  });
});
