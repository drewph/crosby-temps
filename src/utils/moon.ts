const SYNODIC_MONTH_DAYS = 29.530588853;
const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
const FULL_MOON_AGE_DAYS = SYNODIC_MONTH_DAYS / 2;
const DEFAULT_LOOKAHEAD_DAYS = 45;

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
  isoDate: string;
  phase: string;
  illumination: number;
  ageDays: number;
  source: 'api' | 'fallback';
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

export const getUnixTimestampsForNextDays = (startDate: Date, days: number): number[] => {
  if (days < 1) {
    throw new Error('Days must be at least 1');
  }

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate() + index, 12));
    return Math.floor(date.getTime() / 1000);
  });
};

export const getFallbackMoonPhase = (date: Date): MoonPhaseSummary => {
  const ageDays = normalizeLunarAge((date.getTime() - KNOWN_NEW_MOON_MS) / 86400000);
  const illumination = (1 - Math.cos((2 * Math.PI * ageDays) / SYNODIC_MONTH_DAYS)) / 2;

  return {
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

export const findNextFullMoon = (phases: MoonPhaseSummary[]): MoonPhaseSummary | undefined =>
  phases.find((phase) => phase.phase === 'Full Moon');

export const getMoonPhaseOutlookFallback = (startDate: Date, lookaheadDays = DEFAULT_LOOKAHEAD_DAYS) => {
  const phases = getUnixTimestampsForNextDays(startDate, lookaheadDays).map((timestamp) =>
    getFallbackMoonPhase(new Date(timestamp * 1000))
  );

  return {
    current: phases[0],
    nextFullMoon: findNextFullMoon(phases)
  };
};

export const fetchMoonPhaseOutlook = async (startDate: Date, lookaheadDays = DEFAULT_LOOKAHEAD_DAYS) => {
  const fallback = getMoonPhaseOutlookFallback(startDate, lookaheadDays);
  const timestamps = getUnixTimestampsForNextDays(startDate, lookaheadDays);
  const url = buildFarmSenseMoonUrl({ timestamps });

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Moon phase request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as FarmSenseMoonPhase[];
    const phases = parseFarmSenseMoonPhases(payload);
    const current = phases[0] ?? fallback.current;
    const nextFullMoon = findNextFullMoon(phases) ?? fallback.nextFullMoon;

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

export const getApproximateDaysUntilFullMoon = (date: Date): number => {
  const currentAge = normalizeLunarAge((date.getTime() - KNOWN_NEW_MOON_MS) / 86400000);
  const daysUntil = currentAge <= FULL_MOON_AGE_DAYS
    ? FULL_MOON_AGE_DAYS - currentAge
    : SYNODIC_MONTH_DAYS - currentAge + FULL_MOON_AGE_DAYS;

  return Math.round(daysUntil);
};
