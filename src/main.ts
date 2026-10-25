import './style.css';
import { formatDate, getLastNDaysRange, getYesterday } from './utils/dateRanges';
import {
  formatClockTime,
  formatDateWithWeekday,
  formatDayMonth,
  formatFullDateWithWeekday,
  formatModalTemperatureLabel,
  formatPercent,
  formatShortDate,
  formatShortDateFromTimestamp,
  formatTemperature
} from './utils/formatters';
import { buildOpenMeteoArchiveUrl } from './utils/openMeteo';
import { getDaysUntilNextFullMoon, getMoonPhaseOutlook } from './utils/moon';
import { findMissingDates } from './utils/dataQuality';
import { getTempPillColors, getTemperatureScale } from './utils/temperatureBands';
import { buildDays, buildMonthGrid, groupByMonthKey } from './utils/calendar';
import { COMPACT_CALENDAR_QUERY, isCompactCalendar } from './utils/responsive';
import { getYearDateRange, snapshotToDailyResponse } from './utils/yearData';
import { DailyResponse, Day, TemperatureRow } from './types';

type OpenMeteoResponse = {
  daily?: DailyResponse;
};

type RangeOption = 7 | 30 | 60;
type ViewMode = 'list' | 'calendar' | 'year';
const RANGE_OPTIONS: RangeOption[] = [7, 30, 60];

const LOCATION = {
  label: 'Crosby, Isle of Man',
  latitude: 54.18031473227185,
  longitude: -4.54729408020627,
  timezone: 'Europe/London'
};

const DEFAULT_RANGE: RangeOption = 7;
const DEFAULT_VIEW: ViewMode = 'list';
const FETCH_TIMEOUT_MS = 8000;
const MAX_LISTED_MISSING_DATES = 3;
let currentRange: RangeOption = DEFAULT_RANGE;
let currentView: ViewMode = DEFAULT_VIEW;
let cachedDays: Day[] = [];
let compactCalendarEnabled = isCompactCalendar();
let modalOverlay: HTMLDivElement | null = null;
let selectedCalendarCell: HTMLElement | null = null;

type YearRecord = {
  days: Day[];
  source: 'snapshot' | 'archive';
};

const getCurrentYear = (): number =>
  Number(new Intl.DateTimeFormat('en-GB', { timeZone: LOCATION.timezone, year: 'numeric' }).format(new Date()));

let listLastIso: string | undefined;
let listNotice = '';
let yearViewYear = getCurrentYear();
let yearLoadToken = 0;
const yearCache = new Map<number, YearRecord>();

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const locationName = document.getElementById('location-name');
const coordinates = document.getElementById('coordinates');
const status = document.getElementById('status');
const tableBody = document.querySelector('#temperatures tbody');
const cardList = document.getElementById('card-list');
const lastUpdatedElement = document.getElementById('last-updated');
const siteLogo = document.getElementById('site-logo') as HTMLImageElement | null;
const rangeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.range-button'));
const viewButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.view-button'));
const listSection = document.getElementById('list-view');
const calendarSection = document.getElementById('calendar-view');
const yearSection = document.getElementById('year-view');
const rangeControls = document.getElementById('range-controls');
const yearPicker = document.getElementById('year-picker');
const yearSelect = document.getElementById('year-select') as HTMLSelectElement | null;
const moonPhaseElement = document.getElementById('moon-phase');
const moonIlluminationElement = document.getElementById('moon-illumination');
const nextFullMoonElement = document.getElementById('next-full-moon');
const nextFullMoonCountdownElement = document.getElementById('next-full-moon-countdown');
const moonSourceElement = document.getElementById('moon-source');
const colourLegendList = document.getElementById('colour-legend');
const dataNoticeElement = document.getElementById('data-notice');

if (siteLogo) {
  siteLogo.src = `${import.meta.env.BASE_URL}logo.png`;
}

if (locationName) {
  locationName.textContent = LOCATION.label;
}

if (coordinates) {
  coordinates.textContent = `${LOCATION.latitude.toFixed(6)}, ${LOCATION.longitude.toFixed(6)} (${LOCATION.timezone})`;
}

const setStatus = (message: string, isError = false) => {
  if (!status) return;
  status.textContent = message;
  status.classList.toggle('error', isError);
};

const setDataNotice = (message = '') => {
  if (!dataNoticeElement) return;
  dataNoticeElement.textContent = message;
  dataNoticeElement.hidden = message === '';
};

const setDataThrough = (latestIsoDate?: string, detail?: string) => {
  if (!lastUpdatedElement) return;
  if (!latestIsoDate) {
    lastUpdatedElement.textContent = '';
    return;
  }
  const suffix = detail ?? `checked ${formatClockTime(new Date(), LOCATION.timezone)}`;
  lastUpdatedElement.textContent = `Data through ${formatShortDate(latestIsoDate, LOCATION.timezone)} · ${suffix}`;
};

const getYesterdayIso = () => getYesterday(LOCATION.timezone).toISOString().slice(0, 10);

const getFetchSignal = (): AbortSignal | undefined =>
  typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(FETCH_TIMEOUT_MS)
    : undefined;

const isTimeoutError = (error: unknown): boolean =>
  error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError');

const formatMissingDateList = (dates: string[]): string => {
  const listed = dates.slice(0, MAX_LISTED_MISSING_DATES).map((date) => formatDayMonth(date, LOCATION.timezone));
  return dates.length > MAX_LISTED_MISSING_DATES
    ? `${listed.join(', ')} and ${dates.length - MAX_LISTED_MISSING_DATES} more`
    : listed.join(', ');
};

const setMoonStatus = (message = '') => {
  if (!moonSourceElement) return;
  moonSourceElement.textContent = message;
};

const renderColourLegend = () => {
  if (!colourLegendList) return;

  const items = getTemperatureScale().map(({ label, bg }) => {
    const item = document.createElement('li');
    item.className = 'legend__item';

    const swatch = document.createElement('span');
    swatch.className = 'legend__swatch';
    swatch.style.backgroundColor = bg;
    swatch.setAttribute('aria-hidden', 'true');

    const text = document.createElement('span');
    text.className = 'legend__label';
    text.textContent = label;

    item.append(swatch, text);
    return item;
  });

  colourLegendList.replaceChildren(...items);
};

const renderMoonOutlook = () => {
  if (!moonPhaseElement || !moonIlluminationElement || !nextFullMoonElement || !nextFullMoonCountdownElement) {
    return;
  }

  const today = new Date();
  const outlook = getMoonPhaseOutlook(today, LOCATION.timezone);

  moonPhaseElement.textContent = outlook.current.phase;
  moonIlluminationElement.textContent = `Illumination: ${formatPercent(outlook.current.illumination)}`;
  nextFullMoonElement.textContent = formatShortDateFromTimestamp(outlook.nextFullMoon.timestampMs, LOCATION.timezone);

  const daysUntil = getDaysUntilNextFullMoon(today, outlook.nextFullMoon, LOCATION.timezone);
  nextFullMoonCountdownElement.textContent =
    daysUntil === 0 ? "It's the full moon today." : `${daysUntil} day${daysUntil === 1 ? '' : 's'} to go`;

  setMoonStatus('Calculated locally from the lunar cycle.');
};

const createTemperaturePill = (value: number, label: 'Max' | 'Min', variant: 'max' | 'min') => {
  const pill = document.createElement('span');
  pill.className = `pill ${variant}`;
  const { bg, fg } = getTempPillColors(value);
  pill.style.backgroundColor = bg;
  pill.style.color = fg;
  pill.textContent = `${label} ${formatTemperature(value)}°C`;
  return pill;
};

const createCompactTemperaturePill = (value: number, variant: 'max' | 'min', label: 'H' | 'L') => {
  const pill = document.createElement('span');
  pill.className = `pill ${variant} compact`;
  const { bg, fg } = getTempPillColors(value);
  pill.style.backgroundColor = bg;
  pill.style.color = fg;
  pill.textContent = `${label} ${formatTemperature(value)}°`;
  return pill;
};

const createLabeledTemperaturePill = (value: number, variant: 'max' | 'min', label: 'H' | 'L') => {
  const pill = document.createElement('span');
  pill.className = `pill ${variant}`;
  const { bg, fg } = getTempPillColors(value);
  pill.style.backgroundColor = bg;
  pill.style.color = fg;
  pill.textContent = formatModalTemperatureLabel(label, value);
  return pill;
};

const createTemperatureSquare = (max: number, min: number, size: 'sm' | 'md' | 'lg' = 'md') => {
  const square = document.createElement('div');
  square.className = `sq sq--${size}`;
  const { bg: hi } = getTempPillColors(max);
  const { bg: lo } = getTempPillColors(min);
  square.style.setProperty('--hi', hi);
  square.style.setProperty('--lo', lo);

  const inner = document.createElement('div');
  inner.className = 'sq__inner';
  square.appendChild(inner);

  return square;
};

const updateActiveRange = (range: RangeOption) => {
  rangeButtons.forEach((button) => {
    const value = Number(button.dataset.range);
    const isActive = value === range;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
};

const updateActiveView = (view: ViewMode) => {
  viewButtons.forEach((button) => {
    const buttonView = button.dataset.view as ViewMode | undefined;
    const isActive = buttonView === view;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
};

const showView = (view: ViewMode) => {
  if (view !== currentView) {
    closeDayModal();
  }
  currentView = view;
  updateActiveView(view);

  listSection?.classList.toggle('hidden', view !== 'list');
  calendarSection?.classList.toggle('hidden', view !== 'calendar');
  yearSection?.classList.toggle('hidden', view !== 'year');
  rangeControls?.classList.toggle('hidden', view === 'year');
  if (yearPicker) {
    yearPicker.hidden = view !== 'year';
  }

  if (view !== 'year') {
    setStatus('');
  }
};

const handleEscapeClose = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    closeDayModal();
  }
};

const closeDayModal = () => {
  if (modalOverlay) {
    modalOverlay.remove();
    modalOverlay = null;
  }
  if (selectedCalendarCell) {
    selectedCalendarCell.classList.remove('selected');
    selectedCalendarCell = null;
  }
  document.removeEventListener('keydown', handleEscapeClose);
};

const openDayModal = (day: Day, cell: HTMLElement) => {
  closeDayModal();

  selectedCalendarCell = cell;
  selectedCalendarCell.classList.add('selected');

  modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-overlay';

  const sheet = document.createElement('div');
  sheet.className = 'bottom-sheet';

  const header = document.createElement('div');
  header.className = 'bottom-sheet__header';

  const title = document.createElement('h4');
  title.className = 'bottom-sheet__title';
  title.textContent = formatFullDateWithWeekday(day.isoDate, LOCATION.timezone);

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'close-button';
  closeButton.setAttribute('aria-label', 'Close');
  closeButton.textContent = '×';
  closeButton.addEventListener('click', closeDayModal);

  header.append(title, closeButton);

  const pillRow = document.createElement('div');
  pillRow.className = 'pill-row';
  const maxPill = createLabeledTemperaturePill(day.maxC, 'max', 'H');
  const minPill = createLabeledTemperaturePill(day.minC, 'min', 'L');
  pillRow.append(maxPill, minPill);

  const square = createTemperatureSquare(day.maxC, day.minC, 'lg');
  square.classList.add('bottom-sheet__square');

  sheet.append(header, square, pillRow);

  modalOverlay.appendChild(sheet);
  modalOverlay.addEventListener('click', (event) => {
    if (event.target === modalOverlay) {
      closeDayModal();
    }
  });

  document.addEventListener('keydown', handleEscapeClose);
  document.body.appendChild(modalOverlay);
};

const makeDayCellInteractive = (cell: HTMLElement, day: Day) => {
  const label = `${formatFullDateWithWeekday(day.isoDate, LOCATION.timezone)}. High ${formatTemperature(
    day.maxC
  )} degrees Celsius, low ${formatTemperature(day.minC)} degrees.`;

  cell.setAttribute('role', 'button');
  cell.setAttribute('tabindex', '0');
  cell.setAttribute('aria-label', label);

  cell.addEventListener('click', () => openDayModal(day, cell));
  cell.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openDayModal(day, cell);
    }
  });
};

const buildRows = (days: Day[]): TemperatureRow[] =>
  [...days]
    .sort((first, second) => Date.parse(second.isoDate) - Date.parse(first.isoDate))
    .map((day) => ({
      date: day.isoDate,
      max: day.maxC,
      min: day.minC
    }));

const renderTableRows = (rows: TemperatureRow[]) => {
  if (!tableBody) return;
  tableBody.innerHTML = '';

  rows.forEach(({ date, max, min }) => {
    const row = document.createElement('tr');
    const { weekday, date: formattedDate } = formatDateWithWeekday(date, LOCATION.timezone);

    const dateCell = document.createElement('td');
    dateCell.classList.add('date-cell');
    const dateStack = document.createElement('div');
    dateStack.className = 'date-stack';

    const weekdayElement = document.createElement('span');
    weekdayElement.className = 'date-weekday';
    weekdayElement.textContent = weekday;
    const dateElement = document.createElement('span');
    dateElement.textContent = formattedDate;
    dateElement.className = 'date-subtext';
    dateStack.append(weekdayElement, dateElement);
    dateCell.append(dateStack);

    const createTemperatureCell = (value: number, label: 'Max' | 'Min', variant: 'max' | 'min') => {
      const cell = document.createElement('td');
      cell.className = `temp-${variant} col-temp`;
      const pill = createTemperaturePill(value, label, variant);
      cell.appendChild(pill);
      return cell;
    };

    const squareCell = document.createElement('td');
    squareCell.className = 'col-square';
    squareCell.appendChild(createTemperatureSquare(max, min, 'sm'));

    const maxTempCell = createTemperatureCell(max, 'Max', 'max');
    const minTempCell = createTemperatureCell(min, 'Min', 'min');

    row.append(dateCell, squareCell, maxTempCell, minTempCell);
    tableBody.appendChild(row);
  });
};

const renderCards = (rows: TemperatureRow[]) => {
  if (!cardList) return;
  cardList.innerHTML = '';

  rows.forEach(({ date, max, min }) => {
    const card = document.createElement('article');
    card.className = 'temp-card';

    const { weekday, date: formattedDate } = formatDateWithWeekday(date, LOCATION.timezone);
    const headerRow = document.createElement('div');
    headerRow.className = 'card-header';
    const dateRow = document.createElement('div');
    dateRow.className = 'date date-stack';
    const weekdayEl = document.createElement('span');
    weekdayEl.className = 'date-weekday';
    weekdayEl.textContent = weekday;
    const dayEl = document.createElement('span');
    dayEl.className = 'date-subtext';
    dayEl.textContent = formattedDate;
    dateRow.append(weekdayEl, dayEl);

    const square = createTemperatureSquare(max, min, 'md');
    square.classList.add('card-square');
    headerRow.append(dateRow, square);

    const tempsRow = document.createElement('div');
    tempsRow.className = 'temperatures';
    const maxPill = createTemperaturePill(max, 'Max', 'max');
    const minPill = createTemperaturePill(min, 'Min', 'min');

    tempsRow.append(maxPill, minPill);
    card.append(headerRow, tempsRow);
    cardList.appendChild(card);
  });
};

const renderListView = (days: Day[]) => {
  const rows = buildRows(days);
  renderTableRows(rows);
  renderCards(rows);
};

const renderMonthSections = (container: HTMLElement, days: Day[], compact: boolean) => {
  const monthGroups = groupByMonthKey(days);
  const monthFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: LOCATION.timezone,
    month: 'long',
    year: 'numeric'
  });

  monthGroups.forEach(({ monthKey, days: monthDays }) => {
    const [year, month] = monthKey.split('-').map(Number);
    const monthSection = document.createElement('section');
    monthSection.className = 'calendar-month';

    const heading = document.createElement('h3');
    heading.textContent = monthFormatter.format(new Date(Date.UTC(year, (month ?? 1) - 1, 1)));
    monthSection.appendChild(heading);

    const weekdayRow = document.createElement('div');
    weekdayRow.className = 'calendar-weekdays';
    WEEKDAY_LABELS.forEach((label) => {
      const labelEl = document.createElement('div');
      labelEl.className = 'calendar-weekday';
      labelEl.textContent = label;
      weekdayRow.appendChild(labelEl);
    });
    monthSection.appendChild(weekdayRow);

    const grid = buildMonthGrid(year, (month ?? 1) - 1, monthDays);
    const gridEl = document.createElement('div');
    gridEl.className = 'calendar-grid';

    grid.forEach((day) => {
      const cell = document.createElement('div');
      cell.className = 'calendar-cell';

      if (!day) {
        cell.classList.add('empty');
        gridEl.appendChild(cell);
        return;
      }

      if (compact) {
        cell.classList.add('compact');
        const inner = document.createElement('div');
        inner.className = 'dayCell__inner';

        const dayNumber = document.createElement('div');
        dayNumber.className = 'dayNum';
        dayNumber.textContent = day.dayOfMonth.toString();

        const square = createTemperatureSquare(day.maxC, day.minC, 'sm');

        inner.append(dayNumber, square);
        cell.append(inner);
      } else {
        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = day.dayOfMonth.toString();

        const topRow = document.createElement('div');
        topRow.className = 'calendar-top';

        const square = createTemperatureSquare(day.maxC, day.minC, 'sm');
        square.classList.add('calendar-square');
        topRow.append(dayNumber, square);

        const pillStack = document.createElement('div');
        pillStack.className = 'pill-stack';
        const maxPill = createCompactTemperaturePill(day.maxC, 'max', 'H');
        const minPill = createCompactTemperaturePill(day.minC, 'min', 'L');
        pillStack.append(maxPill, minPill);

        cell.append(topRow, pillStack);
      }

      makeDayCellInteractive(cell, day);
      gridEl.appendChild(cell);
    });

    monthSection.appendChild(gridEl);
    container.appendChild(monthSection);
  });
};

const renderCalendarView = (days: Day[]) => {
  if (!calendarSection) return;
  closeDayModal();
  calendarSection.innerHTML = '';

  if (!days.length) {
    const emptyState = document.createElement('p');
    emptyState.className = 'calendar-empty';
    emptyState.textContent = 'No data to display yet.';
    calendarSection.appendChild(emptyState);
    return;
  }

  renderMonthSections(calendarSection, days, compactCalendarEnabled);
};

const renderYearView = () => {
  if (!yearSection) return;
  closeDayModal();
  yearSection.innerHTML = '';

  const record = yearCache.get(yearViewYear);
  if (!record || !record.days.length) {
    const emptyState = document.createElement('p');
    emptyState.className = 'calendar-empty';
    emptyState.textContent = `No data recorded for ${yearViewYear} yet.`;
    yearSection.appendChild(emptyState);
    return;
  }

  renderMonthSections(yearSection, record.days, true);
};

const applyListMeta = () => {
  setDataThrough(listLastIso);
  setDataNotice(listNotice);
};

const applyYearMeta = () => {
  const record = yearCache.get(yearViewYear);
  if (!record || !record.days.length) {
    setDataThrough(undefined);
    setDataNotice('');
    return;
  }

  const days = record.days;
  const lastIso = days[days.length - 1].isoDate;
  const { startDate, endDate } = getYearDateRange(yearViewYear, getYesterdayIso());
  if (!endDate) {
    setDataThrough(undefined);
    setDataNotice('');
    return;
  }

  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const expectedDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const missingDates = findMissingDates(start, end, days.map((day) => day.isoDate));

  setDataThrough(lastIso, record.source === 'snapshot' ? 'frozen snapshot' : 'archive');
  setDataNotice(
    missingDates.length
      ? `No data for ${formatMissingDateList(missingDates)}. Showing ${days.length} of ${expectedDays} days.`
      : ''
  );
};

const renderForCurrentView = () => {
  if (currentView === 'list') {
    renderListView(cachedDays);
    applyListMeta();
    return;
  }

  if (currentView === 'calendar') {
    renderCalendarView(cachedDays);
    applyListMeta();
    return;
  }

  renderYearView();
  applyYearMeta();
};

const handleCompactViewportChange = () => {
  const nextCompact = isCompactCalendar();
  if (nextCompact === compactCalendarEnabled) return;
  compactCalendarEnabled = nextCompact;
  closeDayModal();

  if (currentView === 'calendar') {
    renderCalendarView(cachedDays);
  }
};

const fetchSnapshotYear = async (year: number): Promise<Day[] | undefined> => {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${year}.json`, { signal: getFetchSignal() });
  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok || !contentType.includes('application/json')) {
    return undefined;
  }

  const payload = await response.json();
  const daily = snapshotToDailyResponse(payload);
  return daily ? buildDays(daily) : undefined;
};

const fetchArchiveYear = async (year: number): Promise<Day[]> => {
  const { startDate, endDate } = getYearDateRange(year, getYesterdayIso());
  if (!endDate) {
    return [];
  }

  const url = buildOpenMeteoArchiveUrl({
    latitude: LOCATION.latitude,
    longitude: LOCATION.longitude,
    timezone: LOCATION.timezone,
    startDate,
    endDate
  });

  const response = await fetch(url.toString(), { signal: getFetchSignal() });
  if (!response.ok) {
    throw new Error(`Archive request failed with status ${response.status}`);
  }

  const data: OpenMeteoResponse = await response.json();
  if (!data.daily?.time || !data.daily.temperature_2m_max || !data.daily.temperature_2m_min) {
    throw new Error('Unexpected response format');
  }

  return buildDays(data.daily);
};

const fetchYearRecord = async (year: number): Promise<YearRecord> => {
  try {
    const snapshotDays = await fetchSnapshotYear(year);
    if (snapshotDays?.length) {
      return { days: snapshotDays, source: 'snapshot' };
    }
  } catch (error) {
    console.warn('Snapshot unavailable, falling back to the archive.', error);
  }

  return { days: await fetchArchiveYear(year), source: 'archive' };
};

const loadYear = async (year: number) => {
  const cached = yearCache.get(year);
  if (cached) {
    yearViewYear = year;
    if (currentView === 'year') {
      renderForCurrentView();
      setStatus('');
    }
    return;
  }

  const token = ++yearLoadToken;
  setStatus(`Loading ${year}…`);
  setDataNotice('');

  try {
    const record = await fetchYearRecord(year);
    if (!record.days.length) {
      throw new Error(`No data available for ${year}`);
    }

    yearCache.set(year, record);
    if (token !== yearLoadToken) {
      return;
    }

    yearViewYear = year;
    if (currentView === 'year') {
      renderForCurrentView();
      setStatus('');
    }
  } catch (error) {
    console.error(error);
    if (token !== yearLoadToken || currentView !== 'year') {
      return;
    }

    if (yearSection) {
      yearSection.innerHTML = '';
      const message = document.createElement('p');
      message.className = 'calendar-empty';
      message.textContent = `Unable to load data for ${year}. Please try again later.`;
      yearSection.appendChild(message);
      setDataThrough(undefined);
      setDataNotice('');
    }

    setStatus(
      isTimeoutError(error)
        ? `${year} took too long to load. Please try again.`
        : `Unable to load ${year} right now. Please try again later.`,
      true
    );
  }
};

const fetchTemperatures = async (range: RangeOption) => {
  setStatus('Loading data…');
  setDataNotice('');

  const { start, end } = getLastNDaysRange(range, LOCATION.timezone);
  const expectedDayCount = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);

  const options = {
    latitude: LOCATION.latitude,
    longitude: LOCATION.longitude,
    timezone: LOCATION.timezone,
    startDate: formatDate(start),
    endDate: formatDate(end)
  };
  const archiveUrl = buildOpenMeteoArchiveUrl(options);

  try {
    const response = await fetch(archiveUrl.toString(), { signal: getFetchSignal() });
    if (!response.ok) {
      throw new Error(`Archive request failed with status ${response.status}`);
    }

    const data: OpenMeteoResponse = await response.json();
    if (!data.daily || !data.daily.time || !data.daily.temperature_2m_max || !data.daily.temperature_2m_min) {
      throw new Error('Unexpected response format');
    }

    cachedDays = buildDays(data.daily);
    if (!cachedDays.length) {
      throw new Error('No usable temperature data in response');
    }

    listLastIso = cachedDays[cachedDays.length - 1].isoDate;
    const missingDates = findMissingDates(start, end, cachedDays.map((day) => day.isoDate));
    listNotice = missingDates.length
      ? `No data for ${formatMissingDateList(missingDates)}. Showing ${cachedDays.length} of ${expectedDayCount} days.`
      : '';

    if (currentView !== 'year') {
      renderForCurrentView();
    }
    setStatus('');
  } catch (error) {
    console.error(error);
    cachedDays = [];
    listLastIso = undefined;
    listNotice = '';
    if (currentView !== 'year') {
      renderForCurrentView();
    }
    setStatus(
      isTimeoutError(error)
        ? 'Weather data took too long to load. Please try again.'
        : 'Unable to load weather data right now. Please try again later.',
      true
    );
  }
};

const parseRangeOption = (value: number): RangeOption | undefined =>
  RANGE_OPTIONS.includes(value as RangeOption) ? (value as RangeOption) : undefined;

rangeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const selectedRange = parseRangeOption(Number(button.dataset.range));
    if (!selectedRange || selectedRange === currentRange) {
      // Always refetch to allow manual refresh even if the same range is selected
      fetchTemperatures(currentRange);
      return;
    }
    currentRange = selectedRange;
    updateActiveRange(currentRange);
    fetchTemperatures(currentRange);
  });
});

viewButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const selectedView = button.dataset.view as ViewMode | undefined;
    if (!selectedView || selectedView === currentView) return;

    showView(selectedView);

    if (selectedView === 'year') {
      void loadYear(yearViewYear);
      return;
    }

    renderForCurrentView();
  });
});

const populateYearSelect = () => {
  if (!yearSelect) return;

  const currentYear = getCurrentYear();
  const options = document.createDocumentFragment();
  for (let year = currentYear; year >= 1940; year -= 1) {
    const option = document.createElement('option');
    option.value = String(year);
    option.textContent = String(year);
    options.appendChild(option);
  }

  yearSelect.replaceChildren(options);
  yearSelect.value = String(yearViewYear);

  yearSelect.addEventListener('change', () => {
    const year = Number(yearSelect.value);
    if (!Number.isInteger(year) || year < 1940 || year > currentYear) {
      return;
    }

    yearViewYear = year;
    if (currentView !== 'year') {
      showView('year');
    }
    void loadYear(year);
  });
};

const compactMediaQuery = window.matchMedia(COMPACT_CALENDAR_QUERY);
compactMediaQuery.addEventListener('change', handleCompactViewportChange);
window.addEventListener('resize', handleCompactViewportChange);

showView(DEFAULT_VIEW);
updateActiveRange(DEFAULT_RANGE);
renderColourLegend();
renderMoonOutlook();
populateYearSelect();
void fetchTemperatures(DEFAULT_RANGE);
