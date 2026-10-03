import { isValidCoord, type GeoPhoto } from '@traveldiary/core';

/** A gallery photo with a known location. `uri` can be shown directly by <Image>. */
export interface Photo extends GeoPhoto {
  uri: string;
}

/** What the media store tells us cheaply about every photo, before reading its location. */
export interface AssetMeta {
  id: string;
  creationTime: number | null;
  modificationTime: number | null;
}

/**
 * Cached result per asset, as compact tuples so the cache stays small for galleries of 50k+ photos:
 * [modificationTime, lat, lon, takenAt] when the photo has a usable location, or [modificationTime]
 * when it doesn't (so we don't re-read it on every scan).
 */
type Entry = [number] | [number, number, number, number];
export type ScanCache = Record<string, Entry>;

const VERSION = 1;

export function parseCache(json: string | null): ScanCache {
  if (!json) return {};
  try {
    const data = JSON.parse(json);
    return data?.v === VERSION && data.entries && typeof data.entries === 'object' ? data.entries : {};
  } catch {
    return {};
  }
}

export function serializeCache(cache: ScanCache): string {
  return JSON.stringify({ v: VERSION, entries: cache });
}

/**
 * Work out which assets need their location read: new ones, and ones edited since the last scan.
 * Assets that disappeared from the gallery are dropped from the returned cache.
 */
export function planScan(cache: ScanCache, assets: AssetMeta[]): { toRead: AssetMeta[]; cache: ScanCache } {
  const next: ScanCache = {};
  const toRead: AssetMeta[] = [];
  for (const a of assets) {
    const hit = cache[a.id];
    if (hit && hit[0] === (a.modificationTime ?? 0)) next[a.id] = hit;
    else toRead.push(a);
  }
  return { toRead, cache: next };
}

/** Record what was read for one asset. */
export function recordAsset(
  cache: ScanCache,
  asset: AssetMeta,
  location: { latitude: number; longitude: number } | null,
): void {
  const mod = asset.modificationTime ?? 0;
  cache[asset.id] =
    location && asset.creationTime != null && isValidCoord(location.latitude, location.longitude)
      ? [mod, location.latitude, location.longitude, asset.creationTime]
      : [mod];
}

/** Turn the cache into photos for `buildTravelLog`. On Android the asset id is a content:// URI. */
export function photosFromCache(cache: ScanCache): Photo[] {
  const photos: Photo[] = [];
  for (const [id, e] of Object.entries(cache)) {
    if (e.length === 4) photos.push({ id, uri: id, lat: e[1], lon: e[2], takenAt: new Date(e[3]) });
  }
  return photos;
}
