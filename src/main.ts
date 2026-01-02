import './style.css';
import { formatDate, getLastNDaysRange } from './utils/dateRanges';
import { formatDateWithWeekday, formatLastUpdated, formatTemperature } from './utils/formatters';
import { buildOpenMeteoUrl } from './utils/openMeteo';
import { getTempPillColors } from './utils/temperatureBands';

export type DailyResponse = {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
};

type OpenMeteoResponse = {
  daily?: DailyResponse;
};

export type TemperatureRow = {
  date: string;
  max: number;
  min: number;
};

type RangeOption = 7 | 30 | 60;
const RANGE_OPTIONS: RangeOption[] = [7, 30, 60];
type ViewMode = 'list' | 'calendar';
const VIEW_STORAGE_KEY = 'temperatureView';
const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const LOCATION = {
  label: 'Crosby, Isle of Man',
  latitude: 54.18031473227185,
  longitude: -4.54729408020627,
  timezone: 'Europe/London'
};

const DEFAULT_RANGE: RangeOption = 7;
let currentRange: RangeOption = DEFAULT_RANGE;
let currentView: ViewMode = 'list';
let cachedRows: TemperatureRow[] = [];
const rangeCache: Partial<Record<RangeOption, TemperatureRow[]>> = {};

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

const setLastUpdated = (date?: Date) => {
  if (!lastUpdatedElement) return;
  if (!date) {
    lastUpdatedElement.textContent = '';
    return;
  }
  lastUpdatedElement.textContent = `Last updated: ${formatLastUpdated(date, LOCATION.timezone)}`;
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

const updateActiveRange = (range: RangeOption) => {
  rangeButtons.forEach((button) => {
    const value = Number(button.dataset.range);
    const isActive = value === range;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
};

const parseViewMode = (value?: string): ViewMode | undefined =>
  value === 'list' || value === 'calendar' ? value : undefined;

const getStoredView = (): ViewMode => {
  try {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    const parsed = parseViewMode(stored ?? undefined);
    return parsed ?? 'list';
  } catch (error) {
    console.warn('Unable to read stored view preference', error);
    return 'list';
  }
};

const updateActiveView = (view: ViewMode) => {
  viewButtons.forEach((button) => {
    const value = parseViewMode(button.dataset.view);
    const isActive = value === view;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });

  listSection?.classList.toggle('active', view === 'list');
  calendarSection?.classList.toggle('active', view === 'calendar');
};

const persistView = (view: ViewMode) => {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, view);
  } catch (error) {
    console.warn('Unable to store view preference', error);
  }
};

const setView = (view: ViewMode) => {
  currentView = view;
  updateActiveView(view);
  persistView(view);
  renderCurrentData();
};

export const buildRows = (daily: DailyResponse): TemperatureRow[] =>
  daily.time
    .map((date, index) => ({
      date,
      max: daily.temperature_2m_max[index],
      min: daily.temperature_2m_min[index]
    }))
    .sort((first, second) => Date.parse(second.date) - Date.parse(first.date));

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

    const maxTempCell = createTemperatureCell(max, 'Max', 'max');
    const minTempCell = createTemperatureCell(min, 'Min', 'min');

    row.append(dateCell, maxTempCell, minTempCell);
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
    const dateRow = document.createElement('div');
    dateRow.className = 'date date-stack';
    const weekdayEl = document.createElement('span');
    weekdayEl.className = 'date-weekday';
    weekdayEl.textContent = weekday;
    const dayEl = document.createElement('span');
    dayEl.className = 'date-subtext';
    dayEl.textContent = formattedDate;
    dateRow.append(weekdayEl, dayEl);

    const tempsRow = document.createElement('div');
    tempsRow.className = 'temperatures';
    const maxPill = createTemperaturePill(max, 'Max', 'max');
    const minPill = createTemperaturePill(min, 'Min', 'min');

    tempsRow.append(maxPill, minPill);
    card.append(dateRow, tempsRow);
    cardList.appendChild(card);
  });
};

const getCalendarPlacement = (dateString: string) => {
  const date = new Date(`${dateString}T12:00:00Z`);
  const weekday = (date.getUTCDay() + 6) % 7; // convert to Monday = 0
  const weekStart = new Date(date);
  weekStart.setUTCDate(date.getUTCDate() - weekday);
  return {
    weekday,
    weekStart: weekStart.toISOString().slice(0, 10)
  };
};

const renderCalendarView = (rows: TemperatureRow[]) => {
  if (!calendarSection) return;
  calendarSection.innerHTML = '';

  if (!rows.length) {
    const emptyState = document.createElement('p');
    emptyState.textContent = 'No data available for this range.';
    calendarSection.appendChild(emptyState);
    return;
  }

  const headerRow = document.createElement('div');
  headerRow.className = 'calendar-header';
  WEEKDAY_LABELS.forEach((label) => {
    const header = document.createElement('span');
    header.textContent = label;
    headerRow.appendChild(header);
  });
  calendarSection.appendChild(headerRow);

  const weekMap = new Map<string, Map<number, TemperatureRow>>();
  [...rows]
    .sort((first, second) => Date.parse(first.date) - Date.parse(second.date))
    .forEach((row) => {
      const { weekday, weekStart } = getCalendarPlacement(row.date);
      if (!weekMap.has(weekStart)) {
        weekMap.set(weekStart, new Map());
      }
      weekMap.get(weekStart)?.set(weekday, row);
    });

  const orderedWeeks = [...weekMap.entries()].sort(
    ([firstWeek], [secondWeek]) => Date.parse(firstWeek) - Date.parse(secondWeek)
  );

  orderedWeeks.forEach(([, days]) => {
    const weekRow = document.createElement('div');
    weekRow.className = 'calendar-week';

    WEEKDAY_LABELS.forEach((_, weekdayIndex) => {
      const row = days.get(weekdayIndex);
      const cell = document.createElement('div');
      cell.className = row ? 'calendar-cell' : 'calendar-cell empty';

      if (row) {
        const { weekday, date } = formatDateWithWeekday(row.date, LOCATION.timezone);
        const dateWrapper = document.createElement('div');
        dateWrapper.className = 'calendar-date';
        const weekdayEl = document.createElement('span');
        weekdayEl.textContent = weekday.slice(0, 3);
        const dateEl = document.createElement('span');
        dateEl.className = 'date-subtext';
        dateEl.textContent = date;
        dateWrapper.append(weekdayEl, dateEl);

        const tempsRow = document.createElement('div');
        tempsRow.className = 'calendar-temps';
        const maxPill = createTemperaturePill(row.max, 'Max', 'max');
        const minPill = createTemperaturePill(row.min, 'Min', 'min');
        tempsRow.append(maxPill, minPill);

        cell.append(dateWrapper, tempsRow);
      }

      weekRow.appendChild(cell);
    });

    calendarSection.appendChild(weekRow);
  });
};

const renderListView = (rows: TemperatureRow[]) => {
  renderTableRows(rows);
  renderCards(rows);
};

const renderAllViews = (rows: TemperatureRow[]) => {
  renderListView(rows);
  renderCalendarView(rows);
};

const renderCurrentData = () => {
  if (!cachedRows.length) return;
  renderAllViews(cachedRows);
};

const fetchTemperatures = async (range: RangeOption) => {
  setStatus('Loading data...');
  const cachedRangeRows = rangeCache[range];
  if (cachedRangeRows?.length) {
    cachedRows = cachedRangeRows;
    renderAllViews(cachedRangeRows);
  }

  const { start, end } = getLastNDaysRange(range, LOCATION.timezone);

  const url = buildOpenMeteoUrl({
    latitude: LOCATION.latitude,
    longitude: LOCATION.longitude,
    timezone: LOCATION.timezone,
    startDate: formatDate(start),
    endDate: formatDate(end)
  });

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data: OpenMeteoResponse = await response.json();
    if (!data.daily || !data.daily.time || !data.daily.temperature_2m_max || !data.daily.temperature_2m_min) {
      throw new Error('Unexpected response format');
    }

    const rows = buildRows(data.daily);
    cachedRows = rows;
    rangeCache[range] = rows;
    renderAllViews(rows);
    setLastUpdated(new Date());
    setStatus('');
  } catch (error) {
    console.error(error);
    setStatus('Unable to load weather data right now. Please try again later.', true);
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
    const selectedView = parseViewMode(button.dataset.view);
    if (!selectedView) return;
    if (selectedView === currentView) {
      renderCurrentData();
      return;
    }
    setView(selectedView);
  });
});

currentView = getStoredView();
updateActiveView(currentView);
updateActiveRange(DEFAULT_RANGE);
fetchTemperatures(DEFAULT_RANGE);
