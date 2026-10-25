#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCHEMA_VERSION = 1;
const DAY_MS = 86400000;
const FETCH_TIMEOUT_MS = 30000;
const DATA_DIR = fileURLToPath(new URL('../public/data/', import.meta.url));

const LOCATION = {
  label: 'Crosby, Isle of Man',
  latitude: 54.18031473227185,
  longitude: -4.54729408020627,
  timezone: 'Europe/London'
};

const pad = (value) => String(value).padStart(2, '0');

export const toIsoDate = (date) =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

const getDatePartsInTimeZone = (date, timeZone) => {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );

  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
};

export const getYesterdayIso = (now = new Date(), timeZone = LOCATION.timezone) => {
  const { year, month, day } = getDatePartsInTimeZone(now, timeZone);
  const yesterday = new Date(Date.UTC(year, month - 1, day) - DAY_MS);
  return toIsoDate(yesterday);
};

export const listDateRange = (startIso, endIso) => {
  const start = Date.parse(`${startIso}T00:00:00Z`);
  const end = Date.parse(`${endIso}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return [];
  }

  const dates = [];
  for (let time = start; time <= end; time += DAY_MS) {
    dates.push(toIsoDate(new Date(time)));
  }
  return dates;
};

const roundToOneDecimal = (value) => Math.round(value * 10) / 10;

const sortDays = (days) =>
  Object.fromEntries(Object.entries(days).sort(([left], [right]) => left.localeCompare(right)));

/**
 * Adds days that are not recorded yet and never overwrites an existing date.
 * Entries with missing or non-numeric temperatures are ignored so a later
 * run can fill them in.
 */
export const mergeDays = (existingDays, fetchedDays) => {
  const days = { ...existingDays };
  let added = 0;

  for (const [isoDate, entry] of Object.entries(fetchedDays)) {
    if (Object.prototype.hasOwnProperty.call(days, isoDate)) {
      continue;
    }

    if (!Number.isFinite(entry?.maxC) || !Number.isFinite(entry?.minC)) {
      continue;
    }

    days[isoDate] = entry;
    added += 1;
  }

  return { days: sortDays(days), added };
};

export const buildSnapshotDocument = (days) => ({
  schemaVersion: SCHEMA_VERSION,
  location: LOCATION,
  frozenPolicy: 'first-write',
  days: sortDays(days)
});

const fetchDailyTemperatures = async (startIso, endIso, recordedAt = new Date().toISOString()) => {
  const url = new URL('https://archive-api.open-meteo.com/v1/archive');
  url.searchParams.set('latitude', String(LOCATION.latitude));
  url.searchParams.set('longitude', String(LOCATION.longitude));
  url.searchParams.set('timezone', LOCATION.timezone);
  url.searchParams.set('start_date', startIso);
  url.searchParams.set('end_date', endIso);
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min');
  url.searchParams.set('cell_selection', 'nearest');

  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`Open-Meteo archive request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const daily = payload?.daily;
  if (!daily?.time || !daily.temperature_2m_max || !daily.temperature_2m_min) {
    throw new Error('Unexpected Open-Meteo response format');
  }

  const entries = {};
  daily.time.forEach((isoDate, index) => {
    const maxC = daily.temperature_2m_max[index];
    const minC = daily.temperature_2m_min[index];
    if (!Number.isFinite(maxC) || !Number.isFinite(minC)) {
      return;
    }

    entries[isoDate] = {
      maxC: roundToOneDecimal(maxC),
      minC: roundToOneDecimal(minC),
      source: 'archive',
      recordedAt
    };
  });

  return entries;
};

const loadDays = async (filePath) => {
  try {
    const contents = await readFile(filePath, 'utf8');
    const document = JSON.parse(contents);
    return document?.days ?? {};
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
};

const parseYearArgument = () => {
  const argument = process.argv.find((value) => value.startsWith('--year='));
  if (!argument) {
    return undefined;
  }

  const year = Number(argument.slice('--year='.length));
  if (!Number.isInteger(year) || year < 1940) {
    throw new Error('--year must be a whole year of 1940 or later');
  }
  return year;
};

const main = async () => {
  const now = new Date();
  const yesterday = getYesterdayIso(now);
  const requestedYear = parseYearArgument();
  const targetYear = requestedYear ?? Number(yesterday.slice(0, 4));

  const startIso = `${targetYear}-01-01`;
  const endIso = targetYear === Number(yesterday.slice(0, 4)) ? yesterday : `${targetYear}-12-31`;
  if (endIso < startIso) {
    console.log(`No complete days to record for ${targetYear} yet.`);
    return;
  }

  const filePath = path.join(DATA_DIR, `${targetYear}.json`);
  const existingDays = await loadDays(filePath);
  const fetchedDays = await fetchDailyTemperatures(startIso, endIso);
  const { days, added } = mergeDays(existingDays, fetchedDays);

  if (Object.keys(days).length === 0) {
    throw new Error(`Open-Meteo returned no usable days for ${startIso} to ${endIso}`);
  }

  const missing = listDateRange(startIso, endIso).filter((isoDate) => !days[isoDate]);
  const total = Object.keys(days).length;

  if (added === 0 && existsSync(filePath)) {
    console.log(`${filePath} is already current: ${total} days recorded, ${missing.length} still unavailable.`);
    return;
  }

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(filePath, `${JSON.stringify(buildSnapshotDocument(days), null, 2)}\n`, 'utf8');
  console.log(`Recorded ${added} new day(s) in ${filePath}; ${total} days total, ${missing.length} unavailable.`);
};

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
