import { describe, expect, it, vi } from 'vitest';
import { Geocoder, flagEmoji, parseNominatim, type KeyValueStore } from './geocode';

const LISBON = { lat: 38.7223, lon: -9.1393 };
const nominatimLisbon = {
  name: 'Lisboa',
  address: { city: 'Lisbon', state: 'Lisbon', country: 'Portugal', country_code: 'pt' },
};

const memoryStore = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

describe('geocode', () => {
  it('parses Nominatim responses', () => {
    expect(parseNominatim(nominatimLisbon)).toEqual({
      locality: 'Lisbon',
      region: 'Lisbon',
      country: 'Portugal',
      countryCode: 'PT',
    });
    expect(parseNominatim({ address: { village: 'Óbidos', country_code: 'pt' } })?.locality).toBe('Óbidos');
    expect(parseNominatim({ error: 'Unable to geocode' })).toBeNull();
  });

  it('caches lookups in the store and reuses them', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(nominatimLisbon)));
    const store = memoryStore();
    const g = new Geocoder({ store, fetchFn, minIntervalMs: 0 });

    expect((await g.lookup(LISBON))?.locality).toBe('Lisbon');
    expect((await g.lookup({ lat: LISBON.lat + 0.001, lon: LISBON.lon }))?.locality).toBe('Lisbon');
    expect(fetchFn).toHaveBeenCalledTimes(1);

    // A fresh geocoder with the same store needs no network.
    const g2 = new Geocoder({ store, fetchFn, minIntervalMs: 0 });
    expect((await g2.lookup(LISBON))?.country).toBe('Portugal');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('sends custom headers', async () => {
    const fetchFn = vi.fn(async (_url: string, _init?: { headers?: Record<string, string> }) => new Response(JSON.stringify(nominatimLisbon)));
    const g = new Geocoder({ fetchFn, minIntervalMs: 0, headers: { 'User-Agent': 'TravelDiary-test' } });
    await g.lookup(LISBON);
    expect(fetchFn.mock.calls[0][1]?.headers).toEqual({ 'User-Agent': 'TravelDiary-test' });
    expect(fetchFn.mock.calls[0][0]).toMatch(/lat=38\.7223&lon=-9\.1393/);
  });

  it('returns null on network failure', async () => {
    const g = new Geocoder({ fetchFn: async () => Promise.reject(new Error('offline')), minIntervalMs: 0 });
    expect(await g.lookup(LISBON)).toBeNull();
  });

  it('skips aborted lookups without hitting the network', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(nominatimLisbon)));
    const g = new Geocoder({ fetchFn, minIntervalMs: 0 });
    const ctrl = new AbortController();
    ctrl.abort();
    expect(await g.lookup(LISBON, ctrl.signal)).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('makes flag emoji', () => {
    expect(flagEmoji('PT')).toBe('🇵🇹');
    expect(flagEmoji(undefined)).toBe('');
  });
});
