export const formatDateWithWeekday = (dateString: string, timeZone: string): string => {
  const date = new Date(`${dateString}T12:00:00Z`);
  const weekdayFormatter = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    timeZone
  });
  const weekday = weekdayFormatter.format(date);
  return `${weekday} - ${dateString}`;
};

export const formatTemperature = (temperature: number): string => {
  if (!Number.isFinite(temperature)) {
    return '–';
  }

  const rounded = Math.round(temperature);
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  return normalized.toString();
};
