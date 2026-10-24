const DAY_MS = 86400000;

/**
 * Returns the ISO dates in [start, end] that are absent from `receivedDates`.
 * Both bounds are expected to be UTC midnights, matching getLastNDaysRange.
 */
export const findMissingDates = (start: Date, end: Date, receivedDates: readonly string[]): string[] => {
  if (end.getTime() < start.getTime()) {
    return [];
  }

  const received = new Set(receivedDates);
  const missing: string[] = [];

  for (let time = start.getTime(); time <= end.getTime(); time += DAY_MS) {
    const isoDate = new Date(time).toISOString().slice(0, 10);
    if (!received.has(isoDate)) {
      missing.push(isoDate);
    }
  }

  return missing;
};
