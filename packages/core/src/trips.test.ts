import { describe, expect, it } from 'vitest';
import { haversineKm, isValidCoord } from './geo';
import { buildTravelLog, detectHome, type GeoPhoto } from './trips';

const LONDON = { lat: 51.5074, lon: -0.1278 };
const PARIS = { lat: 48.8566, lon: 2.3522 };
const LYON = { lat: 45.764, lon: 4.8357 };
const ROME = { lat: 41.9028, lon: 12.4964 };

let seq = 0;
const photo = (place: { lat: number; lon: number }, iso: string): GeoPhoto => ({
  id: `p${seq++}`,
  lat: place.lat + (Math.random() - 0.5) * 0.01,
  lon: place.lon + (Math.random() - 0.5) * 0.01,
  takenAt: new Date(iso),
});

/** A photo at home on each of the given days of January 2026. */
const homeDays = (days: number[]) =>
  days.map((d) => photo(LONDON, `2026-01-${String(d).padStart(2, '0')}T12:00:00`));

describe('geo', () => {
  it('computes London–Paris distance', () => {
    expect(haversineKm(LONDON, PARIS)).toBeCloseTo(344, -1);
  });

  it('rejects null-island and out-of-range coordinates', () => {
    expect(isValidCoord(0, 0)).toBe(false);
    expect(isValidCoord(91, 10)).toBe(false);
    expect(isValidCoord(undefined, 10)).toBe(false);
    expect(isValidCoord(LONDON.lat, LONDON.lon)).toBe(true);
  });
});

describe('detectHome', () => {
  it('picks the place photographed on the most days, not the most photos', () => {
    const holiday = Array.from({ length: 50 }, (_, i) =>
      photo(ROME, `2026-02-01T${String(8 + (i % 12)).padStart(2, '0')}:00:00`),
    );
    const home = detectHome([...homeDays([1, 2, 3, 4, 5]), ...holiday])!;
    expect(haversineKm(home, LONDON)).toBeLessThan(5);
  });

  it('returns null with no photos', () => {
    expect(detectHome([])).toBeNull();
  });
});

describe('buildTravelLog', () => {
  it('splits trips when returning home and groups stops', () => {
    const photos = [
      ...homeDays([1, 2, 3, 4, 5, 20, 21, 22]),
      // Trip 1: Paris then Lyon
      photo(PARIS, '2026-01-06T10:00:00'),
      photo(PARIS, '2026-01-06T15:00:00'),
      photo(PARIS, '2026-01-07T11:00:00'),
      photo(LYON, '2026-01-08T09:00:00'),
      photo(LYON, '2026-01-09T18:00:00'),
      // Trip 2: Rome
      photo(ROME, '2026-01-23T10:00:00'),
      photo(ROME, '2026-01-24T10:00:00'),
    ];
    const log = buildTravelLog(photos);

    expect(log.homePhotoCount).toBe(8);
    expect(log.trips).toHaveLength(2);

    const [france, italy] = log.trips;
    expect(france.stops).toHaveLength(2);
    expect(france.stops[0].photos).toHaveLength(3);
    expect(france.stops[1].photos).toHaveLength(2);
    expect(france.days).toBe(4);
    expect(france.distanceKm).toBeCloseTo(haversineKm(PARIS, LYON), -1);
    expect(italy.stops).toHaveLength(1);
    expect(italy.maxDistanceFromHomeKm).toBeGreaterThan(1400);
  });

  it('splits away photos separated by a long gap even without a home photo between them', () => {
    const photos = [
      ...homeDays([1, 2, 3, 4, 5, 6, 7]),
      photo(PARIS, '2026-02-01T10:00:00'),
      photo(PARIS, '2026-02-02T10:00:00'),
      photo(PARIS, '2026-03-01T10:00:00'),
      photo(PARIS, '2026-03-02T10:00:00'),
    ];
    expect(buildTravelLog(photos).trips).toHaveLength(2);
  });

  it('keeps A → B → A as three stops', () => {
    const photos = [
      ...homeDays([1, 2, 3, 4, 5]),
      photo(PARIS, '2026-01-10T10:00:00'),
      photo(LYON, '2026-01-11T10:00:00'),
      photo(PARIS, '2026-01-12T10:00:00'),
    ];
    expect(buildTravelLog(photos).trips[0].stops).toHaveLength(3);
  });

  it('drops single-photo blips and respects an explicit home', () => {
    const photos = [photo(PARIS, '2026-01-10T10:00:00'), photo(ROME, '2026-01-20T10:00:00'), photo(ROME, '2026-01-21T10:00:00')];
    const log = buildTravelLog(photos, { home: LONDON });
    expect(log.trips).toHaveLength(1);
    expect(log.trips[0].stops[0].photos).toHaveLength(2);
  });

  it('handles unsorted input', () => {
    const photos = [
      photo(LYON, '2026-01-08T09:00:00'),
      ...homeDays([1, 2, 3]),
      photo(PARIS, '2026-01-06T10:00:00'),
    ];
    const [trip] = buildTravelLog(photos).trips;
    expect(trip.stops.map((s) => Math.round(s.lat))).toEqual([49, 46]);
  });
});
