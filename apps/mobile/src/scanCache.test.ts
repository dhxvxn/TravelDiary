import { describe, expect, it } from 'vitest';
import { parseCache, photosFromCache, planScan, recordAsset, serializeCache, type ScanCache } from './scanCache';

const meta = (id: string, mod: number) => ({ id, creationTime: 1_700_000_000_000, modificationTime: mod });

describe('scanCache', () => {
  it('reads only new or changed assets and forgets deleted ones', () => {
    const cache: ScanCache = {};
    recordAsset(cache, meta('a', 1), { latitude: 48.85, longitude: 2.35 });
    recordAsset(cache, meta('b', 1), null);
    recordAsset(cache, meta('gone', 1), { latitude: 1, longitude: 1 });

    const { toRead, cache: kept } = planScan(cache, [meta('a', 1), meta('b', 2), meta('new', 1)]);
    expect(toRead.map((a) => a.id)).toEqual(['b', 'new']);
    expect(Object.keys(kept)).toEqual(['a']);
  });

  it('keeps only photos with a usable location and date', () => {
    const cache: ScanCache = {};
    recordAsset(cache, meta('content://1', 5), { latitude: 41.9, longitude: 12.5 });
    recordAsset(cache, meta('content://2', 5), { latitude: 0, longitude: 0 }); // empty GPS block
    recordAsset(cache, { id: 'content://3', creationTime: null, modificationTime: 5 }, { latitude: 41.9, longitude: 12.5 });
    const photos = photosFromCache(cache);
    expect(photos).toEqual([{ id: 'content://1', uri: 'content://1', lat: 41.9, lon: 12.5, takenAt: new Date(1_700_000_000_000) }]);
  });

  it('round-trips through JSON and survives garbage', () => {
    const cache: ScanCache = {};
    recordAsset(cache, meta('x', 3), { latitude: 10, longitude: 20 });
    expect(parseCache(serializeCache(cache))).toEqual(cache);
    expect(parseCache('not json')).toEqual({});
    expect(parseCache(JSON.stringify({ v: 999, entries: cache }))).toEqual({});
    expect(parseCache(null)).toEqual({});
  });
});
