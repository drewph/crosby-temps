export type DailyResponse = {
  time: string[];
  temperature_2m_max: Array<number | null>;
  temperature_2m_min: Array<number | null>;
};

export type Day = {
  isoDate: string;
  date: Date;
  monthKey: string;
  dayOfMonth: number;
  maxC: number;
  minC: number;
  /** True for dates taken from the live archive before the snapshot froze them. */
  provisional?: boolean;
};

export type TemperatureRow = {
  date: string;
  max: number;
  min: number;
  provisional?: boolean;
};
