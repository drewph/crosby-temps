import { describe, expect, it } from 'vitest';
import { buildMonthGrid, groupByMonthKey, mondayIndex } from './calendar';
import { Day } from '../types';

const createDay = (isoDate: string, dayOfMonth: number, monthKey: string): Day => ({
  isoDate,
  date: new Date(`${isoDate}T00:00:00Z`),
  dayOfMonth,
  monthKey,
  maxC: 10,
  minC: 5
});

describe('mondayIndex', () => {
  it('converts Sunday-based indices to Monday-first', () => {
    const monday = new Date('2024-07-01T00:00:00Z');
    const sunday = new Date('2024-07-07T00:00:00Z');
    const tuesday = new Date('2024-07-02T00:00:00Z');

    expect(mondayIndex(monday)).toBe(0);
    expect(mondayIndex(tuesday)).toBe(1);
    expect(mondayIndex(sunday)).toBe(6);
  });
});

describe('buildMonthGrid', () => {
  it('pads leading cells so the 1st aligns under the correct weekday', () => {
    const monthKey = '2024-05';
    const mayFirstWeekdayIndex = 2; // Wednesday should align under the third column (Mon-first)
    const days: Day[] = [
      createDay('2024-05-01', 1, monthKey),
      createDay('2024-05-02', 2, monthKey),
      createDay('2024-05-03', 3, monthKey)
    ];

    const grid = buildMonthGrid(2024, 4, days);

    expect(grid[0]).toBeNull();
    expect(grid[1]).toBeNull();
    expect(grid[mayFirstWeekdayIndex]?.dayOfMonth).toBe(1);
    expect(grid[mayFirstWeekdayIndex + 1]?.dayOfMonth).toBe(2);
  });

  it('adds trailing blanks to complete the final row', () => {
    const monthKey = '2024-07';
    const julyDays: Day[] = [createDay('2024-07-01', 1, monthKey)];

    const grid = buildMonthGrid(2024, 6, julyDays);

    expect(grid.length % 7).toBe(0);
    expect(grid.slice(-6).every((cell) => cell === null)).toBe(true);
  });
});

describe('groupByMonthKey', () => {
  it('groups by month key and preserves ascending month order', () => {
    const days: Day[] = [
      createDay('2024-06-15', 15, '2024-06'),
      createDay('2024-05-20', 20, '2024-05'),
      createDay('2024-06-10', 10, '2024-06'),
      createDay('2024-07-01', 1, '2024-07')
    ];

    const groups = groupByMonthKey(days);

    expect(groups.map((group) => group.monthKey)).toEqual(['2024-05', '2024-06', '2024-07']);
    expect(groups.find((group) => group.monthKey === '2024-06')?.days.length).toBe(2);
  });
});
