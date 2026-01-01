export interface DateRange {
  start: Date;
  end: Date;
}

const extractDateParts = (date: Date, timeZone: string): { year: number; month: number; day: number } => {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const parts = formatter.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    if (part.type === 'year' || part.type === 'month' || part.type === 'day') {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});

  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);

  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    throw new Error('Unable to extract date parts for timezone');
  }

  return { year, month, day };
};

export const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getYesterday = (timeZone = 'UTC'): Date => {
  const today = new Date();
  const { year, month, day } = extractDateParts(today, timeZone);
  const zonedToday = new Date(Date.UTC(year, month - 1, day));
  const yesterday = new Date(zonedToday);
  yesterday.setUTCDate(zonedToday.getUTCDate() - 1);
  yesterday.setUTCHours(0, 0, 0, 0);
  return yesterday;
};

export const getLastNDaysRange = (days: number, timeZone = 'UTC'): DateRange => {
  if (days < 1) {
    throw new Error('Days must be at least 1');
  }

  const end = getYesterday(timeZone);
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - (days - 1));
  return { start, end };
};
