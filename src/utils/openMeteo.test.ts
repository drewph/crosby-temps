import { describe, expect, it } from 'vitest';
import { buildOpenMeteoArchiveUrl, buildOpenMeteoUrl } from './openMeteo';

describe('buildOpenMeteoUrl', () => {
  it('builds a forecast URL with the expected parameters', () => {
    const url = buildOpenMeteoUrl({
      latitude: 54.18031473227185,
      longitude: -4.54729408020627,
      timezone: 'Europe/London',
      startDate: '2024-06-01',
      endDate: '2024-06-07'
    });

    expect(url.origin + url.pathname).toBe('https://api.open-meteo.com/v1/forecast');
    expect(url.searchParams.get('latitude')).toBe('54.18031473227185');
    expect(url.searchParams.get('longitude')).toBe('-4.54729408020627');
    expect(url.searchParams.get('timezone')).toBe('Europe/London');
    expect(url.searchParams.get('start_date')).toBe('2024-06-01');
    expect(url.searchParams.get('end_date')).toBe('2024-06-07');
    expect(url.searchParams.get('daily')).toBe('temperature_2m_max,temperature_2m_min');
    expect(url.searchParams.get('models')).toBeNull();
    expect(url.searchParams.get('cell_selection')).toBe('nearest');
  });
});

describe('buildOpenMeteoArchiveUrl', () => {
  it('builds an archive URL with the expected parameters', () => {
    const url = buildOpenMeteoArchiveUrl({
      latitude: 54.18031473227185,
      longitude: -4.54729408020627,
      timezone: 'Europe/London',
      startDate: '2024-06-01',
      endDate: '2024-06-07'
    });

    expect(url.origin + url.pathname).toBe('https://archive-api.open-meteo.com/v1/archive');
    expect(url.searchParams.get('latitude')).toBe('54.18031473227185');
    expect(url.searchParams.get('longitude')).toBe('-4.54729408020627');
    expect(url.searchParams.get('timezone')).toBe('Europe/London');
    expect(url.searchParams.get('start_date')).toBe('2024-06-01');
    expect(url.searchParams.get('end_date')).toBe('2024-06-07');
    expect(url.searchParams.get('daily')).toBe('temperature_2m_max,temperature_2m_min');
    expect(url.searchParams.get('models')).toBeNull();
    expect(url.searchParams.get('cell_selection')).toBe('nearest');
  });
});
