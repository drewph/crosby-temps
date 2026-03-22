const SYNODIC_MONTH_DAYS = 29.530588853;
const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
const FULL_MOON_AGE_DAYS = SYNODIC_MONTH_DAYS / 2;
const DEFAULT_LOOKAHEAD_DAYS = 45;
const DAY_MS = 86400000;
const HOUR_MS = 3600000;
const SYNODIC_MONTH_MS = SYNODIC_MONTH_DAYS * DAY_MS;
const KNOWN_FULL_MOON_MS = KNOWN_NEW_MOON_MS + FULL_MOON_AGE_DAYS * DAY_MS;
const FULL_MOON_REFINEMENT_HOURS = 36;

export interface MoonApiOptions {
  timestamps: number[];
}

export type FarmSenseMoonPhase = {
  Error?: number;
  ErrorMsg?: string;
  TargetDate?: string;
  Moon?: string[];
  Index?: number;
  Age?: number;
  Phase?: string;
  Illumination?: number;
};

export type MoonPhaseSummary = {
  timestampMs: number;
  isoDate: string;
  phase: string;
  illumination: number;
  ageDays: number;
  source: 'api' | 'fallback';
};

export type MoonEventSummary = {
  timestampMs: number;
  phase: 'Full Moon';
  source: 'api' | 'calculated';
};

const normalizePhaseName = (phase: string): string => phase.replace(/Cresent/g, 'Crescent').trim();

const getPhaseNameFromAge = (ageDays: number): string => {
  if (ageDays < 1.84566) return 'New Moon';
  if (ageDays < 5.53699) return 'Waxing Crescent';
  if (ageDays < 9.22831) return 'First Quarter';
  if (ageDays < 12.91963) return 'Waxing Gibbous';
  if (ageDays < 16.61096) return 'Full Moon';
  if (ageDays < 20.30228) return 'Waning Gibbous';
  if (ageDays < 23.99361) return 'Last Quarter';
  if (ageDays < 27.68493) return 'Waning Crescent';
  return 'New Moon';
};

const normalizeLunarAge = (ageDays: number): number => {
  const mod = ageDays % SYNODIC_MONTH_DAYS;
  return mod >= 0 ? mod : mod + SYNODIC_MONTH_DAYS;
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

const fetchFarmSenseMoonPhases = async (timestamps: number[]): Promise<MoonPhaseSummary[]> => {
  const response = await fetch(buildFarmSenseMoonUrl({ timestamps }).toString());
  if (!response.ok) {
    throw new Error(`Moon phase request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as FarmSenseMoonPhase[];
  return parseFarmSenseMoonPhases(payload);
};

const buildHourlyTimestampsAround = (
  centerTimestampMs: number,
  hoursBefore = FULL_MOON_REFINEMENT_HOURS,
  hoursAfter = FULL_MOON_REFINEMENT_HOURS
): number[] =>
  Array.from({ length: hoursBefore + hoursAfter + 1 }, (_, index) => {
    const offsetHours = index - hoursBefore;
    return Math.floor((centerTimestampMs + offsetHours * HOUR_MS) / 1000);
  });

const toMoonEventSummary = (phase: MoonPhaseSummary, source: MoonEventSummary['source']): MoonEventSummary => ({
  timestampMs: phase.timestampMs,
  phase: 'Full Moon',
  source
});

export const buildFarmSenseMoonUrl = ({ timestamps }: MoonApiOptions): URL => {
  if (!timestamps.length) {
    throw new Error('At least one timestamp is required');
  }

  const url = new URL('https://api.farmsense.net/v1/moonphases/');
  timestamps.forEach((timestamp) => {
    url.searchParams.append('d[]', Math.floor(timestamp).toString());
  });
  return url;
};

export const getUnixTimestampsForNextDays = (startDate: Date, days: number, timeZone = 'UTC'): number[] => {
  if (days < 1) {
    throw new Error('Days must be at least 1');
  }

  const { year, month, day } = extractDateParts(startDate, timeZone);

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1, day + index, 12));
    return Math.floor(date.getTime() / 1000);
  });
};

export const getFallbackMoonPhase = (date: Date): MoonPhaseSummary => {
  const ageDays = normalizeLunarAge((date.getTime() - KNOWN_NEW_MOON_MS) / DAY_MS);
  const illumination = (1 - Math.cos((2 * Math.PI * ageDays) / SYNODIC_MONTH_DAYS)) / 2;

  return {
    timestampMs: date.getTime(),
    isoDate: date.toISOString().slice(0, 10),
    phase: getPhaseNameFromAge(ageDays),
    illumination,
    ageDays,
    source: 'fallback'
  };
};

export const parseFarmSenseMoonPhases = (payload: FarmSenseMoonPhase[]): MoonPhaseSummary[] =>
  payload
    .filter((item) => item.Error === 0 && item.TargetDate && item.Phase)
    .map((item) => {
      const timestampMs = Number(item.TargetDate) * 1000;
      const fallback = getFallbackMoonPhase(new Date(timestampMs));
      return {
        timestampMs,
        isoDate: new Date(timestampMs).toISOString().slice(0, 10),
        phase: normalizePhaseName(item.Phase ?? fallback.phase),
        illumination:
          typeof item.Illumination === 'number' && Number.isFinite(item.Illumination)
            ? item.Illumination
            : fallback.illumination,
        ageDays: typeof item.Age === 'number' && Number.isFinite(item.Age) ? item.Age : fallback.ageDays,
        source: 'api' as const
      };
    });

export const findDailyFullMoonCandidate = (phases: MoonPhaseSummary[]): MoonPhaseSummary | undefined =>
  phases.find((phase) => phase.phase === 'Full Moon');

export const findClosestFullMoonPhase = (phases: MoonPhaseSummary[]): MoonPhaseSummary | undefined =>
  [...phases]
    .sort((left, right) => {
      if (right.illumination !== left.illumination) {
        return right.illumination - left.illumination;
      }

      const ageDelta = Math.abs(left.ageDays - FULL_MOON_AGE_DAYS) - Math.abs(right.ageDays - FULL_MOON_AGE_DAYS);
      if (ageDelta !== 0) {
        return ageDelta;
      }

      return left.timestampMs - right.timestampMs;
    })[0];

export const getNextFullMoon = (startDate: Date): MoonEventSummary => {
  const cyclesSinceKnownFullMoon = Math.ceil((startDate.getTime() - KNOWN_FULL_MOON_MS - 1) / SYNODIC_MONTH_MS);
  const timestampMs = KNOWN_FULL_MOON_MS + Math.max(cyclesSinceKnownFullMoon, 0) * SYNODIC_MONTH_MS;

  return {
    timestampMs,
    phase: 'Full Moon',
    source: 'calculated'
  };
};

export const getMoonPhaseOutlookFallback = (
  startDate: Date,
  lookaheadDays = DEFAULT_LOOKAHEAD_DAYS,
  timeZone = 'UTC'
) => {
  const phases = getUnixTimestampsForNextDays(startDate, lookaheadDays, timeZone).map((timestamp) =>
    getFallbackMoonPhase(new Date(timestamp * 1000))
  );

  return {
    current: phases[0],
    nextFullMoon: getNextFullMoon(startDate)
  };
};

export const fetchMoonPhaseOutlook = async (
  startDate: Date,
  lookaheadDays = DEFAULT_LOOKAHEAD_DAYS,
  timeZone = 'UTC'
) => {
  const fallback = getMoonPhaseOutlookFallback(startDate, lookaheadDays, timeZone);
  const timestamps = getUnixTimestampsForNextDays(startDate, lookaheadDays, timeZone);

  try {
    const phases = await fetchFarmSenseMoonPhases(timestamps);
    const current = phases[0] ?? fallback.current;
    const candidate = findDailyFullMoonCandidate(phases);
    const refinementCenterMs = candidate?.timestampMs ?? fallback.nextFullMoon.timestampMs;

    try {
      const refinementPhases = await fetchFarmSenseMoonPhases(buildHourlyTimestampsAround(refinementCenterMs));
      const refinedFullMoon = findClosestFullMoonPhase(refinementPhases);

      return {
        current,
        nextFullMoon: refinedFullMoon ? toMoonEventSummary(refinedFullMoon, 'api') : fallback.nextFullMoon,
        source: 'api' as const
      };
    } catch (error) {
      console.warn('Falling back to the calculated full-moon event.', error);
      return {
        current,
        nextFullMoon: fallback.nextFullMoon,
        source: 'api' as const
      };
    }
  } catch (error) {
    console.warn('Falling back to locally calculated moon phases.', error);
    return {
      ...fallback,
      source: 'fallback' as const
    };
  }
};

export const getDaysUntilNextFullMoon = (
  startDate: Date,
  nextFullMoon: MoonEventSummary | undefined,
  timeZone = 'UTC'
): number | null => {
  if (!nextFullMoon) {
    return null;
  }

  const currentDate = Date.parse(`${getDateKeyInTimeZone(startDate, timeZone)}T00:00:00Z`);
  const fullMoonDate = Date.parse(`${getDateKeyInTimeZone(new Date(nextFullMoon.timestampMs), timeZone)}T00:00:00Z`);
  return Math.round((fullMoonDate - currentDate) / DAY_MS);
};

export const getApproximateDaysUntilFullMoon = (date: Date): number => {
  const currentAge = normalizeLunarAge((date.getTime() - KNOWN_NEW_MOON_MS) / DAY_MS);
  const daysUntil = currentAge <= FULL_MOON_AGE_DAYS
    ? FULL_MOON_AGE_DAYS - currentAge
    : SYNODIC_MONTH_DAYS - currentAge + FULL_MOON_AGE_DAYS;

  return Math.round(daysUntil);
};
