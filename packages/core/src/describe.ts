import { flagEmoji, type Place } from './geocode';
import type { LatLon } from './geo';
import type { Trip } from './trips';

/** Resolves a point to a place name if one is known (e.g. `geocoder.cached`). */
export type PlaceOf = (point: LatLon) => Place | undefined;

export const TRIP_COLORS = ['#e4572e', '#2e86ab', '#7fb800', '#a23b72', '#f2a541', '#3bb273', '#6d597a', '#00a6a6'];

/** Stable colour for a trip, shared by the map, cards and exports. */
export function tripColor(trip: Trip): string {
  return TRIP_COLORS[Number(trip.id.replace(/\D/g, '')) % TRIP_COLORS.length] ?? TRIP_COLORS[0];
}

export function formatCoord({ lat, lon }: LatLon): string {
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
}

export function placeName(place: Place | undefined, point: LatLon): string {
  return place?.locality ?? formatCoord(point);
}

/** e.g. "🇵🇹 Lisbon → Porto" — consecutive stops in the same town collapse into one. */
export function tripTitle(trip: Trip, placeOf: PlaceOf): string {
  const names: string[] = [];
  const flags: string[] = [];
  for (const stop of trip.stops) {
    const place = placeOf(stop);
    const name = placeName(place, stop);
    if (names[names.length - 1] !== name) names.push(name);
    const flag = flagEmoji(place?.countryCode);
    if (flag && !flags.includes(flag)) flags.push(flag);
  }
  const shown = names.length > 4 ? [...names.slice(0, 3), `+${names.length - 3} more`] : names;
  return `${flags.join('')} ${shown.join(' → ')}`.trim();
}
