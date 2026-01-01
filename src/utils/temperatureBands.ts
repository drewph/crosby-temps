import { getRoundedTemperature } from './formatters';

export type TemperaturePillColors = {
  bg: string;
  fg: string;
};

const TEMPERATURE_BANDS: Array<{ min: number; max: number; colors: TemperaturePillColors }> = [
  { min: Number.NEGATIVE_INFINITY, max: 0, colors: { bg: '#0B1F5E', fg: '#FFFFFF' } },
  { min: 0, max: 3, colors: { bg: '#123C8B', fg: '#FFFFFF' } },
  { min: 3, max: 6, colors: { bg: '#1E5AA8', fg: '#FFFFFF' } },
  { min: 6, max: 9, colors: { bg: '#1D7AAE', fg: '#FFFFFF' } },
  { min: 9, max: 12, colors: { bg: '#1F8A8A', fg: '#FFFFFF' } },
  { min: 12, max: 15, colors: { bg: '#2E9E4D', fg: '#102A43' } },
  { min: 15, max: 18, colors: { bg: '#5FBF4A', fg: '#102A43' } },
  { min: 18, max: 21, colors: { bg: '#8BC34A', fg: '#102A43' } },
  { min: 21, max: 24, colors: { bg: '#C5D82D', fg: '#102A43' } },
  { min: 24, max: 27, colors: { bg: '#F4B400', fg: '#102A43' } },
  { min: 27, max: 30, colors: { bg: '#F57C00', fg: '#102A43' } },
  { min: 30, max: Number.POSITIVE_INFINITY, colors: { bg: '#E53935', fg: '#FFFFFF' } }
];

export const getTempPillColors = (temperatureCelsius: number): TemperaturePillColors => {
  const rounded = getRoundedTemperature(temperatureCelsius);

  if (Number.isNaN(rounded)) {
    return { bg: '#E2E8F0', fg: '#102A43' };
  }

  const match = TEMPERATURE_BANDS.find((band) => rounded >= band.min && rounded < band.max);
  return match ? match.colors : { bg: '#E2E8F0', fg: '#102A43' };
};

