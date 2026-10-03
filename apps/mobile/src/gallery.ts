import { Asset, AssetField, MediaType, Query, presentPermissionsPicker, requestPermissionsAsync, getPermissionsAsync } from 'expo-media-library';
import { File, Paths } from 'expo-file-system';
import { parseCache, photosFromCache, planScan, recordAsset, serializeCache, type AssetMeta, type Photo, type ScanCache } from './scanCache';

export type Access = 'all' | 'limited' | 'denied' | 'undetermined';

function toAccess(r: { granted: boolean; canAskAgain: boolean; accessPrivileges?: string }): Access {
  if (r.granted) return r.accessPrivileges === 'limited' ? 'limited' : 'all';
  return r.canAskAgain ? 'undetermined' : 'denied';
}

export async function checkAccess(): Promise<Access> {
  return toAccess(await getPermissionsAsync(false, ['photo']));
}

/** Ask for photo access. ACCESS_MEDIA_LOCATION is requested alongside it (enabled in app.json). */
export async function requestAccess(): Promise<Access> {
  return toAccess(await requestPermissionsAsync(false, ['photo']));
}

/** Let someone who picked "Select photos" choose more, or switch to all photos (Android 14+). */
export async function chooseMorePhotos(): Promise<void> {
  await presentPermissionsPicker(['photo']).catch(() => undefined);
}

const cacheFile = () => new File(Paths.document, 'scan-cache.json');

export async function loadCachedPhotos(): Promise<{ photos: Photo[]; scanned: number } | null> {
  const file = cacheFile();
  if (!file.exists) return null;
  const cache = parseCache(await file.text());
  return { photos: photosFromCache(cache), scanned: Object.keys(cache).length };
}

function saveCache(cache: ScanCache) {
  const file = cacheFile();
  if (!file.exists) file.create();
  file.write(serializeCache(cache));
}

export function clearCache() {
  const file = cacheFile();
  if (file.exists) file.delete();
}

const PAGE = 1000;
const CONCURRENCY = 8;

export interface ScanProgress {
  phase: 'listing' | 'reading';
  done: number;
  total: number;
}

export interface ScanResult {
  photos: Photo[];
  scanned: number;
  /** Photos whose location couldn't be read at all (e.g. location permission missing). */
  failed: number;
}

/**
 * Scan the gallery. Listing every photo is cheap; reading each photo's location is the slow part,
 * so it's only done for photos that are new or edited since the last scan. Progress is saved as it
 * goes, so an interrupted scan picks up where it left off.
 */
export async function scanGallery(onProgress: (p: ScanProgress) => void, isCancelled: () => boolean): Promise<ScanResult> {
  const assets: AssetMeta[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const page = await new Query()
      .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
      .orderBy({ key: AssetField.CREATION_TIME, ascending: true })
      .offset(offset)
      .limit(PAGE)
      .exeForMetadata();
    for (const a of page) assets.push({ id: a.id, creationTime: a.creationTime, modificationTime: a.modificationTime });
    onProgress({ phase: 'listing', done: assets.length, total: assets.length });
    if (page.length < PAGE || isCancelled()) break;
  }

  const old = parseCache(cacheFile().exists ? await cacheFile().text() : null);
  // Stopped before the listing finished: the list is partial, so pruning against it would wrongly
  // forget photos that simply weren't listed yet. Keep the previous results untouched.
  if (isCancelled()) return { photos: photosFromCache(old), scanned: Object.keys(old).length, failed: 0 };
  const { toRead, cache } = planScan(old, assets);
  let done = 0;
  let failed = 0;
  let next = 0;
  let lastSave = Date.now();

  const worker = async () => {
    while (next < toRead.length && !isCancelled()) {
      const meta = toRead[next++];
      let location: { latitude: number; longitude: number } | null = null;
      try {
        location = await new Asset(meta.id).getLocation();
      } catch {
        failed++;
      }
      recordAsset(cache, meta, location);
      done++;
      if (done % 25 === 0 || done === toRead.length) onProgress({ phase: 'reading', done, total: toRead.length });
      if (Date.now() - lastSave > 5000) {
        lastSave = Date.now();
        saveCache(cache);
      }
    }
  };
  onProgress({ phase: 'reading', done: 0, total: toRead.length });
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  saveCache(cache);

  return { photos: photosFromCache(cache), scanned: Object.keys(cache).length, failed };
}
