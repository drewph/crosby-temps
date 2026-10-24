import { describe, expect, it } from 'vitest';
import { getTempPillColors, getTemperatureScale } from './temperatureBands';

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

describe('getTemperatureScale', () => {
  it('lists every band from cold to warm with readable labels', () => {
    const scale = getTemperatureScale();

    expect(scale).toHaveLength(16);
    expect(scale[0]).toMatchObject({ label: '≤ 0°C', bg: '#5B2A86' });
    expect(scale[1]).toMatchObject({ label: '1–2°C', bg: '#1E3A8A' });
    expect(scale[14]).toMatchObject({ label: '27–28°C', bg: '#8B1E2D' });
    expect(scale[15]).toMatchObject({ label: '≥ 29°C', bg: '#5A0B16' });
  });

  it('covers every rounded temperature exactly once, with the same colours as the pills', () => {
    const scale = getTemperatureScale();

    for (let temperature = -20; temperature <= 45; temperature += 1) {
      const matches = scale.filter((entry) => temperature >= entry.min && temperature <= entry.max);
      expect(matches).toHaveLength(1);
      expect(matches[0].bg).toBe(getTempPillColors(temperature).bg);
    }
  });

  it('has no gaps or overlaps between neighbouring bands', () => {
    const scale = getTemperatureScale();

    for (let index = 1; index < scale.length; index += 1) {
      expect(scale[index].min).toBe(scale[index - 1].max + 1);
    }
  });
});
