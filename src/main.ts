import './style.css';
import { formatDate, getLastNDaysRange } from './utils/dateRanges';
import { buildOpenMeteoUrl } from './utils/openMeteo';

type DailyResponse = {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
};

type OpenMeteoResponse = {
  daily?: DailyResponse;
};

const LOCATION = {
  label: 'Crosby, Isle of Man',
  latitude: 54.166927,
  longitude: -4.551285,
  timezone: 'Europe/London'
};

const locationName = document.getElementById('location-name');
const coordinates = document.getElementById('coordinates');
const status = document.getElementById('status');
const tableBody = document.querySelector('#temperatures tbody');

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

const renderRows = (daily: DailyResponse) => {
  if (!tableBody) return;
  tableBody.innerHTML = '';

  daily.time.forEach((date, index) => {
    const row = document.createElement('tr');
    const maxTemp = daily.temperature_2m_max[index];
    const minTemp = daily.temperature_2m_min[index];

    row.innerHTML = `
      <td>${date}</td>
      <td>${Number.isFinite(maxTemp) ? maxTemp.toFixed(1) : '–'}</td>
      <td>${Number.isFinite(minTemp) ? minTemp.toFixed(1) : '–'}</td>
    `;

    tableBody.appendChild(row);
  });
};

const fetchTemperatures = async () => {
  setStatus('Loading data...');
  const { start, end } = getLastNDaysRange(7);

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

    renderRows(data.daily);
    setStatus('');
  } catch (error) {
    console.error(error);
    setStatus('Unable to load weather data right now. Please try again later.', true);
  }
};

fetchTemperatures();
