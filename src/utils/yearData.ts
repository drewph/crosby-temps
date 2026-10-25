import { DailyResponse } from '../types';

export type SnapshotDay = {
  maxC?: number | null;
  minC?: number | null;
};

export type SnapshotPayload = {
  days?: Record<string, SnapshotDay>;
};

/**
 * Converts a stored snapshot into the shape buildDays expects. Dates are
 * sorted and entries without both temperatures are skipped.
 */
export const snapshotToDailyResponse = (payload: SnapshotPayload): DailyResponse | undefined => {
  const storedDays = payload?.days;
  if (!storedDays || typeof storedDays !== 'object') {
    return undefined;
  }

  const time: string[] = [];
  const temperatureMax: Array<number | null> = [];
  const temperatureMin: Array<number | null> = [];

  Object.keys(storedDays)
    .sort()
    .forEach((isoDate) => {
      const entry = storedDays[isoDate];
      if (typeof entry?.maxC !== 'number' || typeof entry?.minC !== 'number') {
        return;
      }

      time.push(isoDate);
      temperatureMax.push(entry.maxC);
      temperatureMin.push(entry.minC);
    });

  if (!time.length) {
    return undefined;
  }

  return {
    time,
    temperature_2m_max: temperatureMax,
    temperature_2m_min: temperatureMin
  };
};

/**
 * The archive range for a whole year. The current year stops at yesterday;
 * past years stop on 31 December; future years have no range.
 */
export const getYearDateRange = (year: number, yesterdayIso: string): { startDate: string; endDate: string } => {
  const startDate = `${year}-01-01`;
  const currentYear = Number(yesterdayIso.slice(0, 4));

  if (year > currentYear) {
    return { startDate, endDate: '' };
  }

  return {
    startDate,
    endDate: year === currentYear ? yesterdayIso : `${year}-12-31`
  };
};
