export interface DateRange {
  start: Date;
  end: Date;
}

export const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getYesterday = (): Date => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  return yesterday;
};

export const getLastNDaysRange = (days: number): DateRange => {
  if (days < 1) {
    throw new Error('Days must be at least 1');
  }

  const end = getYesterday();
  const start = new Date(end);
  start.setDate(end.getDate() - (days - 1));
  return { start, end };
};
