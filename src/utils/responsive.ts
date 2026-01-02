export const COMPACT_CALENDAR_QUERY = '(max-width: 420px)';

export const isCompactCalendar = (
  matchMediaFn: (query: string) => MediaQueryList = window.matchMedia
): boolean => matchMediaFn(COMPACT_CALENDAR_QUERY).matches;
