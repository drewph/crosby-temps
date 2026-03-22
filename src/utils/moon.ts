const SYNODIC_MONTH_DAYS = 29.530588853;
const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
const DEFAULT_PHASE_COUNT = 12;

export interface MoonLocationOptions {
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface UsnoMoonPhaseOptions {
  date: string;
  numPhases: number;
}

export type UsnoMoonPhaseEntry = {
  phase?: string;
  year?: number;
  month?: number;
  day?: number;
  time?: string;
};

export type UsnoMoonPhasesResponse = {
  phasedata?: UsnoMoonPhaseEntry[];
};

export type MoonPhaseSummary = {
  isoDate: string;
  phase: string;
  illumination: number;
  phaseAngle: number;
  source: 'api' | 'fallback';
  eventDate?: Date;
};

const normalizeLunarAge = (ageDays: number): number => {
  const mod = ageDays % SYNODIC_MONTH_DAYS;
  return mod >= 0 ? mod : mod + SYNODIC_MONTH_DAYS;
};

export const getDateStringInTimeZone = (date: Date, timeZone: string): string => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
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

  return `${parts.year}-${parts.month}-${parts.day}`;
};

const normalizeDegrees = (degrees: number): number => {
  const normalized = degrees % 360;
  return normalized >= 0 ? normalized : normalized + 360;
};

export const getMoonPhaseNameFromDegrees = (degrees: number): string => {
  const normalized = normalizeDegrees(degrees);
  const tolerance = 1;

  if (normalized <= tolerance || normalized >= 360 - tolerance) return 'New Moon';
  if (Math.abs(normalized - 90) <= tolerance) return 'First Quarter';
  if (Math.abs(normalized - 180) <= tolerance) return 'Full Moon';
  if (Math.abs(normalized - 270) <= tolerance) return 'Last Quarter';
  if (normalized < 90) return 'Waxing Crescent';
  if (normalized < 180) return 'Waxing Gibbous';
  if (normalized < 270) return 'Waning Gibbous';
  return 'Waning Crescent';
};

export const getIlluminationFromDegrees = (degrees: number): number =>
  (1 - Math.cos((normalizeDegrees(degrees) * Math.PI) / 180)) / 2;

const getFallbackDegrees = (date: Date): number =>
  (normalizeLunarAge((date.getTime() - KNOWN_NEW_MOON_MS) / 86400000) / SYNODIC_MONTH_DAYS) * 360;

export const getFallbackMoonPhase = (date: Date, timeZone: string): MoonPhaseSummary => {
  const phaseAngle = normalizeDegrees(getFallbackDegrees(date));

  return {
    isoDate: getDateStringInTimeZone(date, timeZone),
    phase: getMoonPhaseNameFromDegrees(phaseAngle),
    illumination: getIlluminationFromDegrees(phaseAngle),
    phaseAngle,
    source: 'fallback'
  };
};

export const buildUsnoMoonPhasesUrl = ({ date, numPhases }: UsnoMoonPhaseOptions): URL => {
  const url = new URL('https://aa.usno.navy.mil/api/moon/phases/date');
  url.searchParams.set('date', date);
  url.searchParams.set('nump', numPhases.toString());
  return url;
};

export const parseUsnoMoonPhaseEntry = (
  entry: UsnoMoonPhaseEntry,
  timeZone: string
): MoonPhaseSummary | undefined => {
  if (!entry.phase || !entry.year || !entry.month || !entry.day || !entry.time) {
    return undefined;
  }

  const [hours, minutes] = entry.time.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return undefined;
  }

  const eventDate = new Date(Date.UTC(entry.year, entry.month - 1, entry.day, hours, minutes));
  const phase = entry.phase.trim();
  const phaseAngle = phase === 'Full Moon' ? 180 : phase === 'New Moon' ? 0 : phase === 'First Quarter' ? 90 : 270;

  return {
    isoDate: getDateStringInTimeZone(eventDate, timeZone),
    phase,
    illumination: getIlluminationFromDegrees(phaseAngle),
    phaseAngle,
    source: 'api',
    eventDate
  };
};

export const parseUsnoMoonPhases = (
  payload: UsnoMoonPhasesResponse,
  timeZone: string
): MoonPhaseSummary[] =>
  (payload.phasedata ?? [])
    .map((entry) => parseUsnoMoonPhaseEntry(entry, timeZone))
    .filter((entry): entry is MoonPhaseSummary => Boolean(entry));

export const getMoonPhaseOutlookFallback = (startDate: Date, timeZone: string) => {
  const current = getFallbackMoonPhase(startDate, timeZone);
  const approxDaysUntilFullMoon = Math.round((180 - current.phaseAngle + 360) % 360 / (360 / SYNODIC_MONTH_DAYS));
  const nextFullMoon = getFallbackMoonPhase(
    new Date(startDate.getTime() + approxDaysUntilFullMoon * 86400000),
    timeZone
  );

  return {
    current,
    nextFullMoon
  };
};

export const getNextFullMoonFromPhases = (phases: MoonPhaseSummary[], startDate: Date): MoonPhaseSummary | undefined =>
  phases.find((phase) => phase.phase === 'Full Moon' && (phase.eventDate?.getTime() ?? 0) >= startDate.getTime());

export const fetchMoonPhaseOutlook = async (startDate: Date, location: MoonLocationOptions) => {
  const fallback = getMoonPhaseOutlookFallback(startDate, location.timezone);
  const startDateString = getDateStringInTimeZone(startDate, location.timezone);
  const url = buildUsnoMoonPhasesUrl({
    date: startDateString,
    numPhases: DEFAULT_PHASE_COUNT
  });

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Moon phase request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as UsnoMoonPhasesResponse;
    const phases = parseUsnoMoonPhases(payload, location.timezone);
    const nextFullMoon = getNextFullMoonFromPhases(phases, startDate) ?? fallback.nextFullMoon;

    return {
      current: fallback.current,
      nextFullMoon,
      source: 'api' as const
    };
  } catch (error) {
    console.warn('Falling back to locally calculated moon phases.', error);
    return {
      ...fallback,
      source: 'fallback' as const
    };
  }
};

export const getDaysUntilNextFullMoon = (current: MoonPhaseSummary, nextFullMoon?: MoonPhaseSummary): number | null => {
  if (!nextFullMoon) {
    return null;
  }

  const currentDate = Date.parse(`${current.isoDate}T00:00:00Z`);
  const fullMoonDate = Date.parse(`${nextFullMoon.isoDate}T00:00:00Z`);
  return Math.round((fullMoonDate - currentDate) / 86400000);
};
