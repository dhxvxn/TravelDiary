import type { Geocoder, TravelLog } from '@traveldiary/core';
import type { Photo } from './scan';

/** Download the travel log as JSON: trips, stops, places and photo file names (no image data). */
export function exportJson(log: TravelLog<Photo>, geocoder: Geocoder) {
  const data = {
    generatedAt: new Date().toISOString(),
    home: log.home && { ...log.home, place: geocoder.cached(log.home) ?? null },
    trips: log.trips.map((t) => ({
      start: t.start.toISOString(),
      end: t.end.toISOString(),
      days: t.days,
      distanceKm: Math.round(t.distanceKm),
      photoCount: t.photoCount,
      stops: t.stops.map((s) => ({
        lat: s.lat,
        lon: s.lon,
        place: geocoder.cached(s) ?? null,
        arrivedAt: s.arrivedAt.toISOString(),
        leftAt: s.leftAt.toISOString(),
        photos: s.photos.map((p) => ({ name: p.name, takenAt: p.takenAt.toISOString(), lat: p.lat, lon: p.lon })),
      })),
    })),
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `travel-log-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
