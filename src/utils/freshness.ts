import { Day } from '../types';

export type DaySeries = {
  days: Day[];
  provisionalDates: string[];
};

const MAX_LISTED_PROVISIONAL_DATES = 2;

/**
 * P: the frozen snapshot is the record for every date it holds, and the live
 * archive fills the tail it has not reached yet. Frozen values always win;
 * live values for unfrozen dates are flagged provisional so the UI can label
 * them instead of presenting them as recorded.
 */
export const mergeFrozenWithLiveTail = (frozenDays: readonly Day[], liveDays: readonly Day[]): DaySeries => {
  const byDate = new Map<string, Day>();

  frozenDays.forEach((day) => {
    byDate.set(day.isoDate, { ...day, provisional: false });
  });

  liveDays.forEach((day) => {
    if (byDate.has(day.isoDate)) {
      return;
    }
    byDate.set(day.isoDate, { ...day, provisional: true });
  });

  const days = [...byDate.values()].sort((first, second) => first.isoDate.localeCompare(second.isoDate));
  const provisionalDates = days.filter((day) => day.provisional).map((day) => day.isoDate);

  return { days, provisionalDates };
};

/**
 * Plain-language note for the provisional tail. `formatDate` keeps the
 * timezone-aware date wording in the caller, so this stays pure and testable.
 */
export const describeProvisionalTail = (
  dates: readonly string[],
  formatDate: (isoDate: string) => string
): string => {
  if (!dates.length) {
    return '';
  }

  const sorted = [...dates].sort();
  const shown = sorted.slice(0, MAX_LISTED_PROVISIONAL_DATES).map(formatDate);
  const subject =
    sorted.length > MAX_LISTED_PROVISIONAL_DATES
      ? `${shown.join(', ')} and ${sorted.length - MAX_LISTED_PROVISIONAL_DATES} more`
      : shown.join(' and ');
  const isSingle = sorted.length === 1;

  return `Provisional: ${subject} ${isSingle ? 'is' : 'are'} from the live archive and may still change until the 06:15 UTC snapshot freezes ${isSingle ? 'it' : 'them'}.`;
};
