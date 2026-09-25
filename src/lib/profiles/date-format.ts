export type MonthNumber = number | null;

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export function monthLabel(month: MonthNumber): string {
  if (!month || month < 1 || month > 12) return '';
  return MONTHS_SHORT[month - 1];
}

/**
 * Human date range for portfolio/editorial display.
 * "Mar 2021 – Present" / "Jun 2019 – Feb 2022" / "2019 – 2020" (year-only fallback).
 */
export function formatDateRange(opts: {
  startYear: number | null;
  startMonth?: MonthNumber;
  endYear?: number | null;
  endMonth?: MonthNumber;
  current?: boolean;
}): string {
  const start =
    opts.startYear == null
      ? ''
      : opts.startMonth
        ? `${monthLabel(opts.startMonth)} ${opts.startYear}`
        : String(opts.startYear);

  if (opts.current) {
    return start ? `${start} – Present` : 'Present';
  }

  const end =
    opts.endYear == null
      ? null
      : opts.endMonth
        ? `${monthLabel(opts.endMonth)} ${opts.endYear}`
        : String(opts.endYear);

  if (!start && !end) return '';
  if (!end) return start;
  if (!start) return end;
  return `${start} – ${end}`;
}
