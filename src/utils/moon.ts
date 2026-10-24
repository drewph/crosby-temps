const SYNODIC_MONTH_DAYS = 29.530588853;
const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
const FULL_MOON_AGE_DAYS = SYNODIC_MONTH_DAYS / 2;
const FIRST_QUARTER_AGE_DAYS = SYNODIC_MONTH_DAYS / 4;
const LAST_QUARTER_AGE_DAYS = (SYNODIC_MONTH_DAYS * 3) / 4;
const EXACT_PHASE_WINDOW_DAYS = 0.5;
const DAY_MS = 86400000;
const SYNODIC_MONTH_MS = SYNODIC_MONTH_DAYS * DAY_MS;
const KNOWN_FULL_MOON_MS = KNOWN_NEW_MOON_MS + FULL_MOON_AGE_DAYS * DAY_MS;

export type MoonPhaseSummary = {
  timestampMs: number;
  isoDate: string;
  phase: string;
  illumination: number;
  ageDays: number;
};

export type MoonEventSummary = {
  timestampMs: number;
  phase: 'Full Moon';
};

export type MoonOutlook = {
  current: MoonPhaseSummary;
  nextFullMoon: MoonEventSummary;
};

const normalizeLunarAge = (ageDays: number): number => {
  const mod = ageDays % SYNODIC_MONTH_DAYS;
  return mod >= 0 ? mod : mod + SYNODIC_MONTH_DAYS;
};

export const getPhaseNameFromAge = (ageDays: number): string => {
  const distanceToFullMoon = Math.abs(ageDays - FULL_MOON_AGE_DAYS);
  if (distanceToFullMoon <= EXACT_PHASE_WINDOW_DAYS) {
    return 'Full Moon';
  }

  const distanceToNewMoon = Math.min(ageDays, SYNODIC_MONTH_DAYS - ageDays);
  if (distanceToNewMoon <= EXACT_PHASE_WINDOW_DAYS) {
    return 'New Moon';
  }

  if (Math.abs(ageDays - FIRST_QUARTER_AGE_DAYS) <= EXACT_PHASE_WINDOW_DAYS) {
    return 'First Quarter';
  }

  if (Math.abs(ageDays - LAST_QUARTER_AGE_DAYS) <= EXACT_PHASE_WINDOW_DAYS) {
    return 'Last Quarter';
  }

  if (ageDays < FIRST_QUARTER_AGE_DAYS) {
    return 'Waxing Crescent';
  }

  if (ageDays < FULL_MOON_AGE_DAYS) {
    return 'Waxing Gibbous';
  }

  if (ageDays < LAST_QUARTER_AGE_DAYS) {
    return 'Waning Gibbous';
  }

  return 'Waning Crescent';
};

export const getMoonPhase = (date: Date): MoonPhaseSummary => {
  const ageDays = normalizeLunarAge((date.getTime() - KNOWN_NEW_MOON_MS) / DAY_MS);
  const illumination = (1 - Math.cos((2 * Math.PI * ageDays) / SYNODIC_MONTH_DAYS)) / 2;

  return {
    timestampMs: date.getTime(),
    isoDate: date.toISOString().slice(0, 10),
    phase: getPhaseNameFromAge(ageDays),
    illumination,
    ageDays
  };
};

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

const getDateKeyInTimeZone = (date: Date, timeZone: string): string => {
  const { year, month, day } = extractDateParts(date, timeZone);
  return `${year}-${`${month}`.padStart(2, '0')}-${`${day}`.padStart(2, '0')}`;
};

export const getNextFullMoon = (startDate: Date): MoonEventSummary => {
  const cyclesSinceKnownFullMoon = Math.ceil((startDate.getTime() - KNOWN_FULL_MOON_MS - 1) / SYNODIC_MONTH_MS);
  const timestampMs = KNOWN_FULL_MOON_MS + Math.max(cyclesSinceKnownFullMoon, 0) * SYNODIC_MONTH_MS;

  return {
    timestampMs,
    phase: 'Full Moon'
  };
};

export const getMoonPhaseOutlook = (startDate: Date, timeZone = 'UTC'): MoonOutlook => {
  const { year, month, day } = extractDateParts(startDate, timeZone);
  const midday = new Date(Date.UTC(year, month - 1, day, 12));

  return {
    current: getMoonPhase(midday),
    nextFullMoon: getNextFullMoon(startDate)
  };
};

export const getDaysUntilNextFullMoon = (
  startDate: Date,
  nextFullMoon: MoonEventSummary,
  timeZone = 'UTC'
): number => {
  const currentDate = Date.parse(`${getDateKeyInTimeZone(startDate, timeZone)}T00:00:00Z`);
  const fullMoonDate = Date.parse(`${getDateKeyInTimeZone(new Date(nextFullMoon.timestampMs), timeZone)}T00:00:00Z`);
  return Math.round((fullMoonDate - currentDate) / DAY_MS);
};
