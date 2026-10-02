import { flagEmoji, type Geocoder, type LatLon, type Place, type Trip } from '@traveldiary/core';

const dayFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export function formatDateRange(start: Date, end: Date): string {
  return dayFmt.formatRange(start, end);
}

export function formatKm(km: number): string {
  return `${Math.round(km).toLocaleString()} km`;
}

export function formatCoord({ lat, lon }: LatLon): string {
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
}

export function placeName(place: Place | undefined, point: LatLon): string {
  return place?.locality ?? formatCoord(point);
}

/** e.g. "🇵🇹 Lisbon → Porto" — consecutive stops in the same town collapse into one. */
export function tripTitle(trip: Trip, geocoder: Geocoder): string {
  const names: string[] = [];
  const flags: string[] = [];
  for (const stop of trip.stops) {
    const place = geocoder.cached(stop);
    const name = placeName(place, stop);
    if (names[names.length - 1] !== name) names.push(name);
    const flag = flagEmoji(place?.countryCode);
    if (flag && !flags.includes(flag)) flags.push(flag);
  }
  const shown = names.length > 4 ? [...names.slice(0, 3), `+${names.length - 3} more`] : names;
  return `${flags.join('')} ${shown.join(' → ')}`.trim();
}

export const TRIP_COLORS = ['#e4572e', '#2e86ab', '#7fb800', '#a23b72', '#f2a541', '#3bb273', '#6d597a', '#00a6a6'];
