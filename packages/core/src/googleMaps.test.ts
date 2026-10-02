import { describe, expect, it } from 'vitest';
import { googleMapsPlaceUrl, googleMapsRouteUrl, kmlColor, MAX_ROUTE_WAYPOINTS, toKml } from './googleMaps';
import { buildTravelLog, type GeoPhoto } from './trips';
import type { Place } from './geocode';

const PARIS = { lat: 48.8566, lon: 2.3522 };
const LYON = { lat: 45.764, lon: 4.8357 };

describe('Google Maps links', () => {
  it('builds a place link', () => {
    expect(googleMapsPlaceUrl(PARIS)).toBe('https://www.google.com/maps/search/?api=1&query=48.85660%2C2.35220');
  });

  it('builds a route link, and falls back to a place link for one point', () => {
    const url = new URL(googleMapsRouteUrl([PARIS, { lat: 47, lon: 3 }, LYON]));
    expect(url.pathname).toBe('/maps/dir/');
    expect(url.searchParams.get('origin')).toBe('48.85660,2.35220');
    expect(url.searchParams.get('destination')).toBe('45.76400,4.83570');
    expect(url.searchParams.get('waypoints')).toBe('47.00000,3.00000');
    expect(googleMapsRouteUrl([PARIS])).toBe(googleMapsPlaceUrl(PARIS));
    expect(new URL(googleMapsRouteUrl([PARIS, LYON])).searchParams.has('waypoints')).toBe(false);
  });

  it('thins long routes to the waypoint limit, keeping start and end', () => {
    const points = Array.from({ length: 20 }, (_, i) => ({ lat: 40 + i, lon: i }));
    const url = new URL(googleMapsRouteUrl(points));
    const waypoints = url.searchParams.get('waypoints')!.split('|');
    expect(waypoints).toHaveLength(MAX_ROUTE_WAYPOINTS);
    expect(new Set(waypoints).size).toBe(MAX_ROUTE_WAYPOINTS);
    expect(url.searchParams.get('origin')).toBe('40.00000,0.00000');
    expect(url.searchParams.get('destination')).toBe('59.00000,19.00000');
  });
});

describe('toKml', () => {
  const at = (p: { lat: number; lon: number }, iso: string, id: string): GeoPhoto & { name: string } => ({
    ...p,
    id,
    name: `${id}.jpg`,
    takenAt: new Date(iso),
  });
  const photos = [
    at(PARIS, '2026-01-06T10:00:00', 'a'),
    at(PARIS, '2026-01-06T12:00:00', 'b'),
    at(LYON, '2026-01-08T10:00:00', 'c'),
  ];
  const places: Record<string, Place> = {
    '49': { locality: 'Paris & <Co>', country: 'France', countryCode: 'FR' },
    '46': { locality: 'Lyon', country: 'France', countryCode: 'FR' },
  };
  const placeOf = (p: { lat: number }) => places[String(Math.round(p.lat))];

  it('exports home, stops and routes as escaped KML', () => {
    const log = buildTravelLog(photos, { home: { lat: 51.5, lon: -0.12 } });
    const kml = toKml(log, { placeOf, photoName: (p) => p.name });
    expect(kml.startsWith('<?xml')).toBe(true);
    expect(kml.match(/<Placemark>/g)).toHaveLength(1 + 2 + 1); // home + 2 stops + route
    expect(kml.match(/<Folder>/g)).toHaveLength(1);
    expect(kml).toContain('<name>1. Paris &amp; &lt;Co&gt;</name>');
    expect(kml).toContain('a.jpg, b.jpg');
    expect(kml).toContain('<coordinates>2.352200,48.856600,0 4.835700,45.764000,0</coordinates>');
    expect(kml).not.toMatch(/<Co>/);
  });

  it('converts colours to aabbggrr', () => {
    expect(kmlColor('#e4572e')).toBe('ff2e57e4');
  });
});
