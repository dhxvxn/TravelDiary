import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { buildTravelLog, placeName, type LatLon, type Trip } from '@traveldiary/core';
import { checkAccess, chooseMorePhotos, clearCache, loadCachedPhotos, requestAccess, scanGallery, type Access, type ScanProgress } from './src/gallery';
import type { Photo } from './src/scanCache';
import { DEFAULT_PREFS, geocoder, loadPrefs, savePrefs, type Prefs } from './src/storage';
import { TravelMap } from './src/components/TravelMap';
import { TripItem } from './src/components/TripItem';
import { SettingsSheet } from './src/components/SettingsSheet';
import { shareJson, shareKml } from './src/exporting';
import { formatKm, formatNumber } from './src/format';
import { useTheme, type Theme } from './src/theme';

type Phase =
  | { name: 'loading' }
  | { name: 'welcome' }
  | { name: 'scanning'; progress: ScanProgress | null }
  | { name: 'log'; photos: Photo[]; scanned: number; failed: number };

export default function App() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}

function Main() {
  const theme = useTheme();
  const s = useMemo(() => makeStyles(theme), [theme]);
  const [phase, setPhase] = useState<Phase>({ name: 'loading' });
  const [access, setAccess] = useState<Access>('undetermined');
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [placesVersion, placesLoaded] = useReducer((n: number) => n + 1, 0);
  const cancelled = useRef(false);

  const setPrefs = useCallback((p: Prefs) => {
    setPrefsState(p);
    savePrefs(p);
  }, []);

  // Start-up: restore settings and the last scan so the log shows instantly.
  useEffect(() => {
    (async () => {
      const [p, a, cached] = await Promise.all([loadPrefs(), checkAccess(), loadCachedPhotos().catch(() => null)]);
      setPrefsState(p);
      setAccess(a);
      setPhase(cached && (a === 'all' || a === 'limited') ? { name: 'log', ...cached, failed: 0 } : { name: 'welcome' });
    })();
  }, []);

  const startScan = useCallback(async () => {
    const a = await requestAccess();
    setAccess(a);
    if (a === 'denied' || a === 'undetermined') {
      Alert.alert('Photo access needed', 'Travel Diary needs access to your photos to read where they were taken.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open settings', onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    cancelled.current = false;
    setPhase({ name: 'scanning', progress: null });
    try {
      const result = await scanGallery(
        (progress) => setPhase({ name: 'scanning', progress }),
        () => cancelled.current,
      );
      setSelectedTripId(null);
      setPhase({ name: 'log', ...result });
    } catch (e) {
      Alert.alert('Scan failed', String(e));
      setPhase({ name: 'welcome' });
    }
  }, []);

  const photos = phase.name === 'log' ? phase.photos : null;
  const log = useMemo(
    () => (photos ? buildTravelLog(photos, { ...prefs.options, home: prefs.homeOverride }) : null),
    [photos, prefs.options, prefs.homeOverride],
  );
  const trips = useMemo(() => (log ? [...log.trips].reverse() : []), [log]);
  const sections = useMemo(() => {
    const byYear = new Map<number, Trip<Photo>[]>();
    for (const t of trips) {
      const y = t.start.getFullYear();
      byYear.set(y, [...(byYear.get(y) ?? []), t]);
    }
    return [...byYear].map(([year, data]) => ({ title: String(year), data }));
  }, [trips]);

  // Place names: newest trips first, debounced, and abandoned when the stops change.
  useEffect(() => {
    if (!log || !prefs.geocode) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      const points: LatLon[] = [...(log.home ? [log.home] : []), ...trips.flatMap((t) => t.stops)];
      for (const p of points) {
        if (geocoder.cached(p)) continue;
        geocoder.lookup(p, ctrl.signal).then((place) => place && !ctrl.signal.aborted && placesLoaded());
      }
    }, 500);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [log, trips, prefs.geocode]);

  const stats = useMemo(() => {
    if (!log) return null;
    const countries = new Set<string>();
    const places = new Set<string>();
    for (const t of log.trips)
      for (const st of t.stops) {
        const place = geocoder.cached(st);
        if (place?.countryCode) countries.add(place.countryCode);
        places.add(placeName(place, st));
      }
    return {
      trips: log.trips.length,
      days: log.trips.reduce((n, t) => n + t.days, 0),
      km: log.trips.reduce((n, t) => n + t.distanceKm, 0),
      countries: countries.size,
      places: places.size,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- placesVersion invalidates the cache reads
  }, [log, placesVersion]);

  const onShare = () => {
    if (!log) return;
    const run = (fn: () => Promise<void>) => fn().catch((e) => Alert.alert('Export failed', String(e)));
    Alert.alert('Export travel log', 'Save to Google Drive, then in Google My Maps choose Create a new map → Import.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'JSON', onPress: () => run(() => shareJson(log, geocoder)) },
      { text: 'Google My Maps (KML)', onPress: () => run(() => shareKml(log, geocoder)) },
    ]);
  };

  if (phase.name === 'loading') {
    return (
      <SafeAreaView style={[s.screen, s.center]}>
        <ActivityIndicator color={theme.accent} />
      </SafeAreaView>
    );
  }

  if (phase.name === 'welcome') {
    return (
      <SafeAreaView style={[s.screen, s.center, { padding: 24, gap: 16 }]}>
        <StatusBar style={theme.dark ? 'light' : 'dark'} />
        <Text style={{ fontSize: 56 }}>🗺️</Text>
        <Text style={s.h1}>Turn your gallery into a travel log</Text>
        <Text style={[s.body, { textAlign: 'center' }]}>
          Travel Diary reads where and when each photo was taken, works out where home is, and groups the rest into trips
          and stops.
        </Text>
        <Pressable style={s.primary} onPress={startScan} accessibilityRole="button">
          <Text style={s.primaryText}>Scan my gallery</Text>
        </Pressable>
        <Text style={[s.small, { textAlign: 'center' }]}>
          🔒 Your photos never leave your phone. Only each stop’s coordinates are sent to OpenStreetMap to look up place
          names, and you can turn that off.
          {access === 'denied' ? '\n\nPhoto access is turned off. Allow it in Settings → Apps → Travel Diary → Permissions.' : ''}
        </Text>
      </SafeAreaView>
    );
  }

  if (phase.name === 'scanning') {
    const p = phase.progress;
    const frac = p && p.phase === 'reading' && p.total > 0 ? p.done / p.total : 0;
    return (
      <SafeAreaView style={[s.screen, s.center, { padding: 24, gap: 14 }]}>
        <Text style={s.h2}>{!p || p.phase === 'listing' ? 'Finding photos…' : 'Reading photo locations…'}</Text>
        <Text style={s.body}>
          {!p
            ? ' '
            : p.phase === 'listing'
              ? `${formatNumber(p.done)} photos found`
              : p.total === 0
                ? 'No new photos since last time'
                : `${formatNumber(p.done)} / ${formatNumber(p.total)} new photos`}
        </Text>
        <View style={s.track}>
          <View style={[s.bar, { width: `${Math.round(frac * 100)}%` }]} />
        </View>
        <Text style={[s.small, { textAlign: 'center' }]}>The first scan of a big gallery can take a few minutes. Later scans only read new photos.</Text>
        <Pressable onPress={() => (cancelled.current = true)} hitSlop={10}>
          <Text style={s.link}>Stop and show what’s scanned so far</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // Log
  return (
    <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <View style={s.topbar}>
        <Text style={s.brand}>🧭 Travel Diary</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <IconButton label="Export" onPress={onShare} theme={theme} />
          <IconButton label="Rescan" onPress={startScan} theme={theme} />
          <IconButton label="⚙️" onPress={() => setSettingsOpen(true)} theme={theme} accessibilityLabel="Settings" />
        </View>
      </View>

      <View style={s.mapBox}>
        <TravelMap
          home={log?.home ?? null}
          trips={trips}
          selectedTripId={selectedTripId}
          onSelectTrip={setSelectedTripId}
          geocoder={geocoder}
          placesVersion={placesVersion}
          theme={theme}
        />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(t) => t.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListHeaderComponent={
          <View style={{ padding: 16, gap: 10 }}>
            {stats && (
              <View style={s.stats}>
                <Stat value={formatNumber(stats.trips)} label={stats.trips === 1 ? 'trip' : 'trips'} theme={theme} />
                <Stat value={formatNumber(stats.days)} label="days away" theme={theme} />
                <Stat value={formatKm(stats.km)} label="travelled" theme={theme} />
                <Stat value={stats.countries ? String(stats.countries) : '–'} label="countries" theme={theme} />
                <Stat value={formatNumber(stats.places)} label="places" theme={theme} />
              </View>
            )}
            <Text style={s.small}>
              {formatNumber(phase.photos.length)} of {formatNumber(phase.scanned)} photos have a location
              {log && log.homePhotoCount ? ` (${formatNumber(log.homePhotoCount)} at home${log.home && geocoder.cached(log.home) ? ` in ${geocoder.cached(log.home)!.locality}` : ''})` : ''}.
              {phase.failed > 0 ? ` ${formatNumber(phase.failed)} couldn’t be read.` : ''}
            </Text>
            {access === 'limited' && (
              <Pressable style={s.banner} onPress={() => chooseMorePhotos().then(startScan)}>
                <Text style={s.bannerText}>You gave access to only some photos. Tap to allow all photos, or pick more.</Text>
              </Pressable>
            )}
            {phase.scanned > 0 && phase.photos.length === 0 && (
              <Text style={s.body}>
                None of your photos have a location. Make sure your camera app saves location (often under Camera settings →
                “Location tags”) and that Travel Diary was allowed to access photo locations.
              </Text>
            )}
            {phase.photos.length > 0 && trips.length === 0 && (
              <Text style={s.body}>No trips found: every photo was taken near home. Try a smaller home radius in Settings.</Text>
            )}
          </View>
        }
        renderSectionHeader={({ section }) => <Text style={s.year}>{section.title}</Text>}
        renderItem={({ item }) => (
          <TripItem
            trip={item}
            geocoder={geocoder}
            placesVersion={placesVersion}
            selected={item.id === selectedTripId}
            onPress={() => setSelectedTripId((cur) => (cur === item.id ? null : item.id))}
            onSetHome={(p) => {
              setPrefs({ ...prefs, homeOverride: { lat: p.lat, lon: p.lon } });
              setSelectedTripId(null);
            }}
            theme={theme}
          />
        )}
      />

      <SettingsSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        options={prefs.options}
        onChange={(options) => setPrefs({ ...prefs, options })}
        geocode={prefs.geocode}
        onGeocodeChange={(geocode) => setPrefs({ ...prefs, geocode })}
        homeOverridden={!!prefs.homeOverride}
        onResetHome={() => setPrefs({ ...prefs, homeOverride: undefined })}
        onForgetScan={() => {
          clearCache();
          setSettingsOpen(false);
          setPhase({ name: 'welcome' });
        }}
        theme={theme}
      />
    </SafeAreaView>
  );
}

function Stat({ value, label, theme }: { value: string; label: string; theme: Theme }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: 10, paddingVertical: 8 }}>
      <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15 }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={{ color: theme.muted, fontSize: 11 }}>{label}</Text>
    </View>
  );
}

function IconButton({ label, onPress, theme, accessibilityLabel }: { label: string; onPress: () => void; theme: Theme; accessibilityLabel?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => ({ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: theme.border, backgroundColor: pressed ? theme.surface2 : theme.surface })}
    >
      <Text style={{ color: theme.text, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    center: { alignItems: 'center', justifyContent: 'center' },
    h1: { color: t.text, fontSize: 24, fontWeight: '700', textAlign: 'center' },
    h2: { color: t.text, fontSize: 18, fontWeight: '700' },
    body: { color: t.text, fontSize: 15, lineHeight: 21 },
    small: { color: t.muted, fontSize: 13, lineHeight: 18 },
    link: { color: t.accent, fontWeight: '600' },
    primary: { backgroundColor: t.accent, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 999 },
    primaryText: { color: t.accentText, fontSize: 16, fontWeight: '700' },
    track: { width: '100%', height: 8, borderRadius: 4, backgroundColor: t.surface2, overflow: 'hidden' },
    bar: { height: 8, backgroundColor: t.accent },
    topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: t.surface, borderBottomWidth: 1, borderBottomColor: t.border },
    brand: { color: t.text, fontSize: 17, fontWeight: '700' },
    mapBox: { height: '38%', borderBottomWidth: 1, borderBottomColor: t.border },
    stats: { flexDirection: 'row', gap: 6 },
    banner: { backgroundColor: t.surface2, borderRadius: 10, padding: 12 },
    bannerText: { color: t.text, fontSize: 13 },
    year: { color: t.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1, marginHorizontal: 16, marginTop: 8, marginBottom: 6 },
  });
