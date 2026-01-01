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

const LOCATION = {
  label: 'Crosby, Isle of Man',
  latitude: 54.18031473227185,
  longitude: -4.54729408020627,
  timezone: 'Europe/London'
};

const DEFAULT_RANGE: RangeOption = 7;
let currentRange: RangeOption = DEFAULT_RANGE;

const locationName = document.getElementById('location-name');
const coordinates = document.getElementById('coordinates');
const status = document.getElementById('status');
const tableBody = document.querySelector('#temperatures tbody');
const cardList = document.getElementById('card-list');
const lastUpdatedElement = document.getElementById('last-updated');
const rangeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.range-button'));

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
    const { weekday, date: originalDate } = formatDateWithWeekday(date, LOCATION.timezone);

    const dateCell = document.createElement('td');
    const weekdayElement = document.createElement('strong');
    weekdayElement.textContent = weekday;
    const dateElement = document.createElement('span');
    dateElement.textContent = originalDate;
    dateElement.classList.add('date-text');
    dateCell.append(weekdayElement, document.createTextNode(' - '), dateElement);

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

    const { weekday, date: originalDate } = formatDateWithWeekday(date, LOCATION.timezone);
    const dateRow = document.createElement('div');
    dateRow.className = 'date';
    const weekdayEl = document.createElement('span');
    weekdayEl.className = 'weekday';
    weekdayEl.textContent = weekday;
    const dayEl = document.createElement('span');
    dayEl.className = 'day';
    dayEl.textContent = originalDate;
    dateRow.append(weekdayEl, document.createTextNode(' • '), dayEl);

    const tempsRow = document.createElement('div');
    tempsRow.className = 'temperatures';
    const maxPill = createTemperaturePill(max, 'Max', 'max');
    const minPill = createTemperaturePill(min, 'Min', 'min');

    tempsRow.append(maxPill, minPill);
    card.append(dateRow, tempsRow);
    cardList.appendChild(card);
  });
};

const render = (rows: TemperatureRow[]) => {
  renderTableRows(rows);
  renderCards(rows);
};

const fetchTemperatures = async (range: RangeOption) => {
  setStatus('Loading data...');

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
    render(rows);
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

updateActiveRange(DEFAULT_RANGE);
fetchTemperatures(DEFAULT_RANGE);
