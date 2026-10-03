import exifr from 'exifr';
import { isValidCoord, type GeoPhoto } from '@traveldiary/core';
import { folderOf, summarizeFolders, type FolderStat, type Outcome } from './folders';

export interface Photo extends GeoPhoto {
  file: File;
  name: string;
}

export interface ScanResult {
  photos: Photo[];
  /** Images that had no usable GPS position. */
  noLocation: number;
  /** Images with a position but no capture date (can't be placed on the timeline). */
  noDate: number;
  /** Files that couldn't be parsed at all. */
  failed: number;
  /** How many images in each folder had a location, to show where location data is missing. */
  folders: FolderStat[];
}

/**
 * Paths of drag-and-dropped files. Files dropped from a folder carry no `webkitRelativePath`, so the
 * drop handler records each one's path here.
 */
export const dropPaths = new WeakMap<File, string>();

const pathOf = (file: File) => dropPaths.get(file) ?? file.webkitRelativePath ?? '';

const IMAGE_EXT = /\.(jpe?g|heic|heif|png|tiff?|webp|dng|avif)$/i;

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || IMAGE_EXT.test(file.name);
}

async function readPhoto(file: File): Promise<Photo | 'noLocation' | 'noDate' | 'failed'> {
  try {
    const tags = await exifr.parse(file, {
      gps: true,
      exif: true,
      tiff: true,
      ifd1: false,
      xmp: false,
      icc: false,
      iptc: false,
      jfif: false,
      pick: ['latitude', 'longitude', 'GPSLatitude', 'GPSLongitude', 'GPSLatitudeRef', 'GPSLongitudeRef', 'DateTimeOriginal', 'CreateDate'],
    });
    if (!tags || !isValidCoord(tags.latitude, tags.longitude)) return 'noLocation';
    const takenAt: unknown = tags.DateTimeOriginal ?? tags.CreateDate;
    if (!(takenAt instanceof Date) || Number.isNaN(takenAt.getTime())) return 'noDate';
    return {
      id: `${file.name}-${file.size}-${file.lastModified}`,
      file,
      name: file.name,
      lat: tags.latitude,
      lon: tags.longitude,
      takenAt,
    };
  } catch {
    return 'failed';
  }
}

/** Read EXIF location + date from every image, a few at a time. Everything stays on this device. */
export async function scanFiles(
  files: File[],
  onProgress: (done: number, total: number) => void,
  concurrency = 8,
): Promise<ScanResult> {
  const images = files.filter(isImageFile);
  const result: ScanResult = { photos: [], noLocation: 0, noDate: 0, failed: 0, folders: [] };
  const outcomes: { folder: string; outcome: Outcome }[] = [];
  const seen = new Set<string>();
  let next = 0;
  let done = 0;

  const worker = async () => {
    while (next < images.length) {
      const file = images[next++];
      const r = await readPhoto(file);
      outcomes.push({ folder: folderOf(pathOf(file)), outcome: typeof r === 'string' ? r : 'located' });
      if (typeof r === 'string') result[r]++;
      else if (!seen.has(r.id)) {
        seen.add(r.id);
        result.photos.push(r);
      }
      onProgress(++done, images.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, images.length) }, worker));
  result.folders = summarizeFolders(outcomes);
  return result;
}

const BROWSER_DISPLAYABLE = /\.(jpe?g|png|webp|gif|avif)$/i;
const thumbCache = new Map<string, Promise<string | null>>();

/** URL for showing a photo. HEIC and friends fall back to the small JPEG preview embedded in the EXIF. */
export function thumbnailUrl(photo: Photo): Promise<string | null> {
  let url = thumbCache.get(photo.id);
  if (!url) {
    url = BROWSER_DISPLAYABLE.test(photo.name)
      ? Promise.resolve(URL.createObjectURL(photo.file))
      : exifr.thumbnailUrl(photo.file).then((u) => u ?? null, () => null);
    thumbCache.set(photo.id, url);
  }
  return url;
}
