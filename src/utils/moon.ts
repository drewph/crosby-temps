const SYNODIC_MONTH_DAYS = 29.530588853;
const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
const DEFAULT_FULL_MOON_SEARCH_WINDOW_DAYS = 2;
const FULL_MOON_DEGREES = 180;

export interface MoonLocationOptions {
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface MoonApiOptions extends MoonLocationOptions {
  date: string;
  offset: string;
}

export type MetNoMoonResponse = {
  properties?: {
    moonphase?: {
      value?: number;
    };
  };
};

export type MoonPhaseSummary = {
  isoDate: string;
  phase: string;
  illumination: number;
  phaseAngle: number;
  source: 'api' | 'fallback';
};

const getDatePartsInTimeZone = (date: Date, timeZone: string) => {
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

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day)
  };
};

export const getDateStringInTimeZone = (date: Date, timeZone: string): string => {
  const { year, month, day } = getDatePartsInTimeZone(date, timeZone);
  return `${year}-${`${month}`.padStart(2, '0')}-${`${day}`.padStart(2, '0')}`;
};

export const getTimeZoneOffset = (date: Date, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    timeZoneName: 'longOffset',
    hour: '2-digit',
    minute: '2-digit'
  }).formatToParts(date);

  const offsetName = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';
  if (offsetName === 'GMT') {
    return '+00:00';
  }

  return offsetName.replace('GMT', '');
};

export const buildMetNoMoonUrl = ({ latitude, longitude, date, offset }: MoonApiOptions): URL => {
  const url = new URL('https://api.met.no/weatherapi/sunrise/3.0/moon');
  url.searchParams.set('lat', latitude.toString());
  url.searchParams.set('lon', longitude.toString());
  url.searchParams.set('date', date);
  url.searchParams.set('offset', offset);
  return url;
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

const normalizeLunarAge = (ageDays: number): number => {
  const mod = ageDays % SYNODIC_MONTH_DAYS;
  return mod >= 0 ? mod : mod + SYNODIC_MONTH_DAYS;
};

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

export const parseMetNoMoonResponse = (
  payload: MetNoMoonResponse,
  date: Date,
  timeZone: string
): MoonPhaseSummary => {
  const fallback = getFallbackMoonPhase(date, timeZone);
  const phaseAngle = payload.properties?.moonphase?.value;

  if (typeof phaseAngle !== 'number' || !Number.isFinite(phaseAngle)) {
    return fallback;
  }

  return {
    isoDate: getDateStringInTimeZone(date, timeZone),
    phase: getMoonPhaseNameFromDegrees(phaseAngle),
    illumination: getIlluminationFromDegrees(phaseAngle),
    phaseAngle: normalizeDegrees(phaseAngle),
    source: 'api'
  };
};

export const addDaysToDateString = (dateString: string, days: number): string => {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export const getDateRangeAround = (dateString: string, radius: number): string[] =>
  Array.from({ length: radius * 2 + 1 }, (_, index) => addDaysToDateString(dateString, index - radius));

export const getMoonPhaseOutlookFallback = (startDate: Date, timeZone: string) => {
  const current = getFallbackMoonPhase(startDate, timeZone);
  const approxDaysUntilFullMoon = Math.round(
    ((FULL_MOON_DEGREES - current.phaseAngle + 360) % 360) / (360 / SYNODIC_MONTH_DAYS)
  );
  const nextFullMoon = getFallbackMoonPhase(
    new Date(new Date(startDate).setUTCDate(startDate.getUTCDate() + approxDaysUntilFullMoon)),
    timeZone
  );

  return {
    current,
    nextFullMoon
  };
};

export const pickClosestToFullMoon = (phases: MoonPhaseSummary[]): MoonPhaseSummary | undefined =>
  [...phases]
    .sort((first, second) => {
      const firstDelta = Math.abs(first.phaseAngle - FULL_MOON_DEGREES);
      const secondDelta = Math.abs(second.phaseAngle - FULL_MOON_DEGREES);
      if (firstDelta !== secondDelta) {
        return firstDelta - secondDelta;
      }
      return first.isoDate.localeCompare(second.isoDate);
    })
    .at(0);

const fetchMoonPhaseForDate = async (dateString: string, location: MoonLocationOptions) => {
  const targetDate = new Date(`${dateString}T12:00:00Z`);
  const offset = getTimeZoneOffset(targetDate, location.timezone);
  const url = buildMetNoMoonUrl({
    latitude: location.latitude,
    longitude: location.longitude,
    date: dateString,
    offset
  });

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Moon phase request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as MetNoMoonResponse;
  return parseMetNoMoonResponse(payload, targetDate, location.timezone);
};

export const fetchMoonPhaseOutlook = async (startDate: Date, location: MoonLocationOptions) => {
  const fallback = getMoonPhaseOutlookFallback(startDate, location.timezone);
  const todayDateString = getDateStringInTimeZone(startDate, location.timezone);
  const approxFullMoonDate = fallback.nextFullMoon.isoDate;
  const candidateDates = getDateRangeAround(approxFullMoonDate, DEFAULT_FULL_MOON_SEARCH_WINDOW_DAYS);

  try {
    const [current, ...candidatePhases] = await Promise.all([
      fetchMoonPhaseForDate(todayDateString, location),
      ...candidateDates.map((dateString) => fetchMoonPhaseForDate(dateString, location))
    ]);

    const nextFullMoon = pickClosestToFullMoon(candidatePhases) ?? fallback.nextFullMoon;

    return {
      current,
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
