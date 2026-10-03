import { describe, expect, it } from 'vitest';
import { formatDateRange, formatNumber, plural } from './format';

describe('format', () => {
  it('formats date ranges compactly', () => {
    expect(formatDateRange(new Date(2026, 0, 6), new Date(2026, 0, 9))).toBe('6–9 Jan 2026');
    expect(formatDateRange(new Date(2026, 0, 30), new Date(2026, 1, 2))).toBe('30 Jan – 2 Feb 2026');
    expect(formatDateRange(new Date(2025, 11, 30), new Date(2026, 0, 2))).toBe('30 Dec 2025 – 2 Jan 2026');
    expect(formatDateRange(new Date(2026, 4, 1, 9), new Date(2026, 4, 1, 18))).toBe('1 May 2026');
  });

  it('formats numbers', () => {
    expect(formatNumber(1234567.4)).toBe('1,234,567');
    expect(plural(1, 'trip')).toBe('1 trip');
    expect(plural(3, 'country', 'countries')).toBe('3 countries');
  });
});
