export type MonthNumber = number | null;

/**
 * True when a start date is after an end date (invalid range).
 * Months only compared when both are known; current roles are always valid.
 */
export function isDateRangeInvalid(opts: {
  startYear: number | null;
  startMonth?: MonthNumber;
  endYear?: number | null;
  endMonth?: MonthNumber;
  current?: boolean;
}): boolean {
  if (opts.current) return false;
  const { startYear, endYear } = opts;
  if (startYear == null || endYear == null) return false;
  if (startYear > endYear) return true;
  if (startYear < endYear) return false;
  // same year — compare months only when both known
  const sm = opts.startMonth;
  const em = opts.endMonth;
  if (sm && em && sm > em) return true;
  return false;
}

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
