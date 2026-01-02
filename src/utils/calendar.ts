import { DailyResponse, Day } from '../types';
import { getRoundedTemperature } from './formatters';

export type MonthGroup = {
  monthKey: string;
  days: Day[];
};

const createDay = (isoDate: string, max: number, min: number): Day => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const monthKey = `${year}-${`${month}`.padStart(2, '0')}`;
  return {
    isoDate,
    date,
    monthKey,
    dayOfMonth: date.getUTCDate(),
    maxC: getRoundedTemperature(max),
    minC: getRoundedTemperature(min)
  };
};

export const buildDays = (daily: DailyResponse): Day[] => {
  const days = daily.time.map((isoDate, index) =>
    createDay(isoDate, daily.temperature_2m_max[index], daily.temperature_2m_min[index])
  );

  return days.sort((first, second) => first.isoDate.localeCompare(second.isoDate));
};

export const mondayIndex = (date: Date): number => {
  const sundayBased = date.getUTCDay();
  return (sundayBased + 6) % 7;
};

export const buildMonthGrid = (year: number, monthZeroIndexed: number, daysInMonthRange: Day[]): Array<Day | null> => {
  const firstOfMonth = new Date(Date.UTC(year, monthZeroIndexed, 1));
  const daysInMonth = new Date(Date.UTC(year, monthZeroIndexed + 1, 0)).getUTCDate();
  const leadingEmptyCells = mondayIndex(firstOfMonth);
  const cells: Array<Day | null> = Array.from({ length: leadingEmptyCells }, () => null);
  const daysByDayOfMonth = new Map<number, Day>();

  daysInMonthRange.forEach((day) => {
    if (day.date.getUTCFullYear() === year && day.date.getUTCMonth() === monthZeroIndexed) {
      daysByDayOfMonth.set(day.dayOfMonth, day);
    }
  });

  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
    cells.push(daysByDayOfMonth.get(dayNumber) ?? null);
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
};

export const groupByMonthKey = (days: Day[]): MonthGroup[] => {
  const sortedDays = [...days].sort((first, second) => first.isoDate.localeCompare(second.isoDate));
  const groups = new Map<string, Day[]>();

  sortedDays.forEach((day) => {
    const monthDays = groups.get(day.monthKey) ?? [];
    monthDays.push(day);
    groups.set(day.monthKey, monthDays);
  });

  return Array.from(groups.entries())
    .sort(([monthKeyA], [monthKeyB]) => monthKeyA.localeCompare(monthKeyB))
    .map(([monthKey, monthDays]) => ({ monthKey, days: monthDays }));
};
