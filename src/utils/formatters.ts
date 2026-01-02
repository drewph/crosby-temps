export type FormattedDateWithWeekday = {
  weekday: string;
  date: string;
};

export const getRoundedTemperature = (temperature: number): number => {
  if (!Number.isFinite(temperature)) {
    return Number.NaN;
  }

  const rounded = Math.round(temperature);
  return Object.is(rounded, -0) ? 0 : rounded;
};

export const formatLastUpdated = (date: Date, timeZone: string): string => {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  return formatter.format(date);
};

export const formatDateWithWeekday = (dateString: string, timeZone: string): FormattedDateWithWeekday => {
  const date = new Date(`${dateString}T12:00:00Z`);
  const weekdayFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'long'
  });
  const dateFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  return {
    weekday: weekdayFormatter.format(date),
    date: dateFormatter.format(date)
  };
};

export const formatFullDateWithWeekday = (dateString: string, timeZone: string): string => {
  const date = new Date(`${dateString}T12:00:00Z`);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return formatter.format(date);
};

export const formatTemperature = (temperature: number): string => {
  const rounded = getRoundedTemperature(temperature);
  if (Number.isNaN(rounded)) {
    return '–';
  }

  return rounded.toString();
};

export const formatModalTemperatureLabel = (label: 'H' | 'L', temperature: number): string =>
  `${label} ${formatTemperature(temperature)}°`;
