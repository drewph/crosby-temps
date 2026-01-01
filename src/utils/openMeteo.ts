export interface OpenMeteoOptions {
  latitude: number;
  longitude: number;
  timezone: string;
  startDate: string;
  endDate: string;
}

const DAILY_VARIABLES = ['temperature_2m_max', 'temperature_2m_min'];

export const buildOpenMeteoUrl = ({
  latitude,
  longitude,
  timezone,
  startDate,
  endDate
}: OpenMeteoOptions): URL => {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', latitude.toString());
  url.searchParams.set('longitude', longitude.toString());
  url.searchParams.set('timezone', timezone);
  url.searchParams.set('start_date', startDate);
  url.searchParams.set('end_date', endDate);
  url.searchParams.set('daily', DAILY_VARIABLES.join(','));
  return url;
};
