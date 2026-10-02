import type { LatLon } from './geo';
import { placeName, tripColor, tripTitle, type PlaceOf } from './describe';
import type { GeoPhoto, TravelLog, Trip } from './trips';

/** Google Maps URLs accept at most this many intermediate waypoints. */
export const MAX_ROUTE_WAYPOINTS = 9;

const coord = ({ lat, lon }: LatLon) => `${lat.toFixed(5)},${lon.toFixed(5)}`;

/** Link that opens a single location in Google Maps (web or app). No API key needed. */
export function googleMapsPlaceUrl(point: LatLon): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coord(point))}`;
}

/** Evenly pick `n` items from `items`, keeping the order. */
function sample<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items;
  return Array.from({ length: n }, (_, i) => items[Math.round(((i + 0.5) * items.length) / n - 0.5)]);
}

/**
 * Link that opens a route through the given points in Google Maps. Routes with more stops than
 * Google allows are thinned out evenly; the start and end are always kept.
 */
export function googleMapsRouteUrl(points: LatLon[]): string {
  if (points.length === 0) throw new Error('googleMapsRouteUrl needs at least one point');
  if (points.length === 1) return googleMapsPlaceUrl(points[0]);
  const origin = points[0];
  const destination = points[points.length - 1];
  const waypoints = sample(points.slice(1, -1), MAX_ROUTE_WAYPOINTS);
  const params = new URLSearchParams({ api: '1', origin: coord(origin), destination: coord(destination) });
  if (waypoints.length > 0) params.set('waypoints', waypoints.map(coord).join('|'));
  return `https://www.google.com/maps/dir/?${params}`;
}

const escapeXml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);

/** "#rrggbb" → KML's "aabbggrr". */
export function kmlColor(hex: string, alpha = 'ff'): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return `${alpha}ffffff`;
  return `${alpha}${m[3]}${m[2]}${m[1]}`.toLowerCase();
}

const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayRange = (a: Date, b: Date) => (isoDay(a) === isoDay(b) ? isoDay(a) : `${isoDay(a)} → ${isoDay(b)}`);
// KML coordinates are lon,lat[,alt].
const kmlCoord = ({ lat, lon }: LatLon) => `${lon.toFixed(6)},${lat.toFixed(6)},0`;

export interface KmlOptions<P extends GeoPhoto> {
  placeOf: PlaceOf;
  /** Name of each photo, listed in the stop description. Omit to leave photo names out. */
  photoName?: (photo: P) => string;
  documentName?: string;
}

/**
 * The whole travel log as a KML document, for importing into Google My Maps or Google Earth: a home
 * placemark, then one folder per trip with a placemark per stop and the route as a line.
 */
export function toKml<P extends GeoPhoto>(log: TravelLog<P>, opts: KmlOptions<P>): string {
  const { placeOf, photoName, documentName = 'Travel Diary' } = opts;
  const out: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<kml xmlns="http://www.opengis.net/kml/2.2">',
    '<Document>',
    `<name>${escapeXml(documentName)}</name>`,
  ];

  for (const trip of log.trips) {
    const color = tripColor(trip);
    out.push(
      `<Style id="${trip.id}">`,
      `<IconStyle><color>${kmlColor(color)}</color></IconStyle>`,
      `<LineStyle><color>${kmlColor(color)}</color><width>3</width></LineStyle>`,
      '</Style>',
    );
  }

  if (log.home) {
    out.push(
      '<Placemark>',
      `<name>${escapeXml(`🏠 Home (${placeName(placeOf(log.home), log.home)})`)}</name>`,
      `<Point><coordinates>${kmlCoord(log.home)}</coordinates></Point>`,
      '</Placemark>',
    );
  }

  for (const trip of log.trips) out.push(...tripKml(trip, placeOf, photoName));

  out.push('</Document>', '</kml>');
  return out.join('\n');
}

function tripKml<P extends GeoPhoto>(trip: Trip<P>, placeOf: PlaceOf, photoName?: (p: P) => string): string[] {
  const title = tripTitle(trip, placeOf);
  const summary = `${dayRange(trip.start, trip.end)} · ${trip.days} day(s) · ${trip.photoCount} photos · ${Math.round(trip.distanceKm)} km`;
  const out = ['<Folder>', `<name>${escapeXml(`${isoDay(trip.start)} ${title}`)}</name>`, `<description>${escapeXml(summary)}</description>`];

  trip.stops.forEach((stop, i) => {
    const place = placeOf(stop);
    const where = [place?.region, place?.country].filter((x) => x && x !== place?.locality).join(', ');
    const lines = [dayRange(stop.arrivedAt, stop.leftAt), `${stop.photos.length} photos`, where];
    if (photoName) lines.push(stop.photos.map(photoName).join(', '));
    out.push(
      '<Placemark>',
      `<name>${escapeXml(`${i + 1}. ${placeName(place, stop)}`)}</name>`,
      `<description>${escapeXml(lines.filter(Boolean).join('\n'))}</description>`,
      `<styleUrl>#${trip.id}</styleUrl>`,
      `<TimeSpan><begin>${stop.arrivedAt.toISOString()}</begin><end>${stop.leftAt.toISOString()}</end></TimeSpan>`,
      `<Point><coordinates>${kmlCoord(stop)}</coordinates></Point>`,
      '</Placemark>',
    );
  });

  if (trip.stops.length > 1) {
    out.push(
      '<Placemark>',
      `<name>${escapeXml(`Route: ${title}`)}</name>`,
      `<styleUrl>#${trip.id}</styleUrl>`,
      `<LineString><tessellate>1</tessellate><coordinates>${trip.stops.map(kmlCoord).join(' ')}</coordinates></LineString>`,
      '</Placemark>',
    );
  }
  out.push('</Folder>');
  return out;
}
