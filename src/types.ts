export type DailyResponse = {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
};

export type Day = {
  isoDate: string;
  date: Date;
  monthKey: string;
  dayOfMonth: number;
  maxC: number;
  minC: number;
};

export type TemperatureRow = {
  date: string;
  max: number;
  min: number;
};
