export { formatCoord, placeName, tripColor, tripTitle } from '@traveldiary/core';

const dayFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export function formatDateRange(start: Date, end: Date): string {
  return dayFmt.formatRange(start, end);
}

export function formatKm(km: number): string {
  return `${Math.round(km).toLocaleString()} km`;
}
