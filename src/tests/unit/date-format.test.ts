import { describe, it, expect } from 'vitest';
import { formatDateRange, monthLabel } from '../../lib/profiles/date-format';

describe('formatDateRange', () => {
  it('formats month + year ranges', () => {
    expect(formatDateRange({ startYear: 2019, startMonth: 6, endYear: 2022, endMonth: 2 })).toBe(
      'Jun 2019 – Feb 2022'
    );
  });

  it('shows Present for current roles', () => {
    expect(formatDateRange({ startYear: 2022, startMonth: 3, current: true })).toBe(
      'Mar 2022 – Present'
    );
  });

  it('falls back to years when months are missing', () => {
    expect(formatDateRange({ startYear: 2014, endYear: 2018 })).toBe('2014 – 2018');
  });

  it('handles open-ended entries without a current flag', () => {
    expect(formatDateRange({ startYear: 2020, endYear: null })).toBe('2020');
  });

  it('monthLabel is safe for out-of-range values', () => {
    expect(monthLabel(0)).toBe('');
    expect(monthLabel(13)).toBe('');
    expect(monthLabel(1)).toBe('Jan');
    expect(monthLabel(null)).toBe('');
  });
});
