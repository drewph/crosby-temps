export type FormattedDateWithWeekday = {
  weekday: string;
  date: string;
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
    weekday: 'long',
    timeZone
  });
  const weekday = weekdayFormatter.format(date);
  return {
    weekday,
    date: dateString
  };
};

export const formatTemperature = (temperature: number): string => {
  if (!Number.isFinite(temperature)) {
    return '–';
  }

  const rounded = Math.round(temperature);
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  return normalized.toString();
};
