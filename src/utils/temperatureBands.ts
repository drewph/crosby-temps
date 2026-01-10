import { getRoundedTemperature } from './formatters';

export type TemperaturePillColors = {
  bg: string;
  fg: string;
};

const TEMPERATURE_BANDS: Array<{ min: number; max: number; colors: TemperaturePillColors }> = [
  { min: Number.NEGATIVE_INFINITY, max: 0, colors: { bg: '#5B2A86', fg: '#FFFFFF' } },
  { min: 1, max: 2, colors: { bg: '#1E3A8A', fg: '#FFFFFF' } },
  { min: 3, max: 4, colors: { bg: '#3B82F6', fg: '#FFFFFF' } },
  { min: 5, max: 6, colors: { bg: '#60A5FA', fg: '#102A43' } },
  { min: 7, max: 8, colors: { bg: '#1F5E3B', fg: '#FFFFFF' } },
  { min: 9, max: 10, colors: { bg: '#34D399', fg: '#102A43' } },
  { min: 11, max: 12, colors: { bg: '#F4C542', fg: '#102A43' } },
  { min: 13, max: 14, colors: { bg: '#F4A3C0', fg: '#102A43' } },
  { min: 15, max: 16, colors: { bg: '#C7B6FF', fg: '#102A43' } },
  { min: 17, max: 18, colors: { bg: '#6D5BD0', fg: '#FFFFFF' } },
  { min: 19, max: 20, colors: { bg: '#E6579A', fg: '#FFFFFF' } },
  { min: 21, max: 22, colors: { bg: '#D08A95', fg: '#102A43' } },
  { min: 23, max: 24, colors: { bg: '#7A3DBA', fg: '#FFFFFF' } },
  { min: 25, max: 26, colors: { bg: '#E23B3B', fg: '#FFFFFF' } },
  { min: 27, max: 28, colors: { bg: '#8B1E2D', fg: '#FFFFFF' } },
  { min: 29, max: Number.POSITIVE_INFINITY, colors: { bg: '#5A0B16', fg: '#FFFFFF' } }
];

export const getTempPillColors = (temperatureCelsius: number): TemperaturePillColors => {
  const rounded = getRoundedTemperature(temperatureCelsius);

  if (Number.isNaN(rounded)) {
    return { bg: '#E2E8F0', fg: '#102A43' };
  }

  const match = TEMPERATURE_BANDS.find((band) => rounded >= band.min && rounded <= band.max);
  return match ? match.colors : { bg: '#E2E8F0', fg: '#102A43' };
};
