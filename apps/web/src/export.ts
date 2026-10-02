import { toKml, type Geocoder, type TravelLog } from '@traveldiary/core';
import type { Photo } from './scan';

const today = () => new Date().toISOString().slice(0, 10);

function download(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

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
  download(`travel-log-${today()}.json`, JSON.stringify(data, null, 2), 'application/json');
}

/** Download the travel log as KML, ready to import into Google My Maps or Google Earth. */
export function exportKml(log: TravelLog<Photo>, geocoder: Geocoder) {
  const kml = toKml(log, { placeOf: (p) => geocoder.cached(p), photoName: (p) => p.name });
  download(`travel-log-${today()}.kml`, kml, 'application/vnd.google-earth.kml+xml');
}
