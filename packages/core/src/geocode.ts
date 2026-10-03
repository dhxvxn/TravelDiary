import type { LatLon } from './geo';
import { query } from './query';

export interface Place {
  /** Most specific useful name: city, town, village, or failing that the region. */
  locality: string;
  region?: string;
  country?: string;
  countryCode?: string;
}

/** Minimal persistent string store: localStorage on web, AsyncStorage on React Native, etc. */
export interface KeyValueStore {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
}

export interface GeocoderOptions {
  store?: KeyValueStore;
  /** Preferred language for place names, e.g. "en" or "fr-FR". */
  language?: string;
  /** Nominatim allows at most 1 request per second. */
  minIntervalMs?: number;
  endpoint?: string;
  fetchFn?: FetchLike;
  /** Extra request headers. Apps should send a User-Agent identifying themselves, per Nominatim's policy. */
  headers?: Record<string, string>;
}

export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

const CACHE_KEY = 'traveldiary.geocode.v1';

/** Cache key rounded to ~1 km so nearby stops share a lookup. */
const keyFor = ({ lat, lon }: LatLon) => `${lat.toFixed(2)},${lon.toFixed(2)}`;

export function parseNominatim(data: any): Place | null {
  if (!data || data.error) return null;
  const a = data.address ?? {};
  return {
    locality:
      a.city ?? a.town ?? a.village ?? a.municipality ?? a.hamlet ?? a.county ?? a.state ?? data.name ?? 'Unknown place',
    region: a.state ?? a.region ?? a.county,
    country: a.country,
    countryCode: typeof a.country_code === 'string' ? a.country_code.toUpperCase() : undefined,
  };
}

/**
 * Reverse geocoder backed by OpenStreetMap Nominatim. Requests are serialised and throttled to respect
 * the usage policy, and results are cached in the given store so re-scanning the same gallery is instant.
 */
export class Geocoder {
  private cache: Record<string, Place> = {};
  private loaded: Promise<void>;
  private queue: Promise<unknown> = Promise.resolve();
  private lastRequest = 0;
  private readonly opts: Required<Omit<GeocoderOptions, 'store'>> & { store?: KeyValueStore };

  constructor(options: GeocoderOptions = {}) {
    this.opts = {
      language: 'en',
      minIntervalMs: 1100,
      endpoint: 'https://nominatim.openstreetmap.org/reverse',
      fetchFn: (url, init) => fetch(url, init),
      headers: {},
      ...options,
    };
    this.loaded = this.load();
  }

  private async load() {
    try {
      const raw = await this.opts.store?.getItem(CACHE_KEY);
      if (raw) this.cache = JSON.parse(raw);
    } catch {
      this.cache = {};
    }
  }

  private async persist() {
    try {
      await this.opts.store?.setItem(CACHE_KEY, JSON.stringify(this.cache));
    } catch {
      // Storage full or blocked: the cache is a nicety, carry on without it.
    }
  }

  /** Synchronous cache peek, for rendering without waiting. */
  cached(point: LatLon): Place | undefined {
    return this.cache[keyFor(point)];
  }

  /**
   * Look up a point. Lookups run one at a time; pass an AbortSignal to drop queued lookups that are no
   * longer needed (e.g. the user changed settings and the stops moved) without spending a request on them.
   */
  lookup(point: LatLon, signal?: AbortSignal): Promise<Place | null> {
    const job = this.queue.then(async () => {
      await this.loaded;
      const hit = this.cached(point);
      if (hit) return hit;
      if (signal?.aborted) return null;
      try {
        const place = await this.fetchPlace(point);
        if (place) {
          this.cache[keyFor(point)] = place;
          await this.persist();
        }
        return place;
      } catch {
        return null;
      }
    });
    this.queue = job;
    return job;
  }

  private async fetchPlace(point: LatLon): Promise<Place | null> {
    const wait = this.lastRequest + this.opts.minIntervalMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastRequest = Date.now();

    const params = query({
      format: 'jsonv2',
      lat: String(point.lat),
      lon: String(point.lon),
      zoom: '10',
      'accept-language': this.opts.language,
    });
    const res = await this.opts.fetchFn(`${this.opts.endpoint}?${params}`, { headers: this.opts.headers });
    if (!res.ok) return null;
    return parseNominatim(await res.json());
  }
}

export function flagEmoji(countryCode?: string): string {
  if (!countryCode || !/^[A-Z]{2}$/.test(countryCode)) return '';
  return String.fromCodePoint(...[...countryCode].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
