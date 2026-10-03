import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_OPTIONS, Geocoder, type LatLon, type TripOptions } from '@traveldiary/core';

export const geocoder = new Geocoder({
  store: AsyncStorage,
  language: Intl.DateTimeFormat().resolvedOptions().locale || 'en',
  // Nominatim's usage policy asks apps to identify themselves.
  headers: { 'User-Agent': 'TravelDiary/0.1 (Android app; https://github.com/dhxvxn/TravelDiary)' },
});

export interface Prefs {
  options: TripOptions;
  homeOverride?: LatLon;
  geocode: boolean;
}

const KEY = 'traveldiary.prefs.v1';
export const DEFAULT_PREFS: Prefs = { options: DEFAULT_OPTIONS, geocode: true };

export async function loadPrefs(): Promise<Prefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw);
    return { ...DEFAULT_PREFS, ...p, options: { ...DEFAULT_OPTIONS, ...p.options } };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: Prefs) {
  AsyncStorage.setItem(KEY, JSON.stringify(prefs)).catch(() => undefined);
}
