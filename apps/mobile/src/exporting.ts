import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { toKml, type Geocoder, type TravelLog } from '@traveldiary/core';
import type { Photo } from './scanCache';

const today = () => new Date().toISOString().slice(0, 10);

async function share(name: string, text: string, mimeType: string, dialogTitle: string) {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(text);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle });
}

/** Share a KML file, e.g. save it to Google Drive and import it into Google My Maps. */
export function shareKml(log: TravelLog<Photo>, geocoder: Geocoder) {
  const kml = toKml(log, { placeOf: (p) => geocoder.cached(p) });
  return share(`travel-log-${today()}.kml`, kml, 'application/vnd.google-earth.kml+xml', 'Export for Google My Maps');
}

export function shareJson(log: TravelLog<Photo>, geocoder: Geocoder) {
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
        photoCount: s.photos.length,
      })),
    })),
  };
  return share(`travel-log-${today()}.json`, JSON.stringify(data, null, 2), 'application/json', 'Export travel log');
}
