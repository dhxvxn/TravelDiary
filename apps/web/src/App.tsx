import { useEffect, useMemo, useReducer, useState } from 'react';
import { buildTravelLog, DEFAULT_OPTIONS, Geocoder, type LatLon, type Trip, type TripOptions } from '@traveldiary/core';
import { scanFiles, type Photo, type ScanResult } from './scan';
import { PickScreen } from './components/PickScreen';
import { TravelMap } from './components/TravelMap';
import { TripCard } from './components/TripCard';
import { Settings } from './components/Settings';
import { formatKm, placeName } from './format';
import { exportJson, exportKml } from './export';

const geocoder = new Geocoder({
  store: {
    getItem: (k) => {
      try {
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    },
    setItem: (k, v) => {
      try {
        localStorage.setItem(k, v);
      } catch {
        /* storage unavailable */
      }
    },
  },
  language: navigator.language || 'en',
});

type Phase = { name: 'pick' } | { name: 'scanning'; done: number; total: number } | { name: 'log'; scan: ScanResult };

export function App() {
  const [phase, setPhase] = useState<Phase>({ name: 'pick' });
  const [options, setOptions] = useState<TripOptions>(DEFAULT_OPTIONS);
  const [homeOverride, setHomeOverride] = useState<LatLon | undefined>();
  const [geocode, setGeocode] = useState(true);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  // Bumped whenever a place name arrives so titles re-render from the geocoder cache.
  const [placesVersion, placesLoaded] = useReducer((n: number) => n + 1, 0);

  const photos = phase.name === 'log' ? phase.scan.photos : null;
  const log = useMemo(
    () => (photos ? buildTravelLog(photos, { ...options, home: homeOverride }) : null),
    [photos, options, homeOverride],
  );
  const trips = useMemo(() => (log ? [...log.trips].reverse() : []), [log]); // newest first

  // Look up place names for every stop (and home), newest trips first. Debounced so dragging a
  // settings slider doesn't queue hundreds of requests for stops that are about to change.
  useEffect(() => {
    if (!log || !geocode) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      const points = [...(log.home ? [log.home] : []), ...trips.flatMap((t) => t.stops)];
      for (const p of points) {
        if (geocoder.cached(p)) continue;
        geocoder.lookup(p, ctrl.signal).then((place) => place && !ctrl.signal.aborted && placesLoaded());
      }
    }, 500);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [log, trips, geocode]);

  async function handleFiles(files: File[]) {
    setPhase({ name: 'scanning', done: 0, total: files.length });
    let lastPaint = 0;
    const scan = await scanFiles(files, (done, total) => {
      const now = performance.now();
      if (done === total || now - lastPaint > 100) {
        lastPaint = now;
        setPhase({ name: 'scanning', done, total });
      }
    });
    setSelectedTripId(null);
    setHomeOverride(undefined);
    setPhase({ name: 'log', scan });
  }

  const stats = useMemo(() => {
    if (!log) return null;
    const countries = new Set<string>();
    const places = new Set<string>();
    for (const t of log.trips)
      for (const s of t.stops) {
        const place = geocoder.cached(s);
        if (place?.countryCode) countries.add(place.countryCode);
        places.add(placeName(place, s));
      }
    return {
      trips: log.trips.length,
      days: log.trips.reduce((n, t) => n + t.days, 0),
      km: log.trips.reduce((n, t) => n + t.distanceKm, 0),
      countries: countries.size,
      places: places.size,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- placesVersion invalidates the geocoder cache reads
  }, [log, placesVersion]);

  return (
    <div className="app">
      <header className="topbar">
        <h1>
          <span aria-hidden>🧭</span> Travel Diary
        </h1>
        {phase.name === 'log' && (
          <div className="topbar-actions">
            <button onClick={() => log && exportKml(log, geocoder)} title="Download a KML file to import into Google My Maps or Google Earth">
              Export for Google My Maps
            </button>
            <button onClick={() => log && exportJson(log, geocoder)}>Export JSON</button>
            <button onClick={() => setPhase({ name: 'pick' })}>Scan other photos</button>
          </div>
        )}
      </header>

      {phase.name === 'pick' && <PickScreen onFiles={handleFiles} />}

      {phase.name === 'scanning' && (
        <div className="scanning">
          <p>
            Reading photo locations… {phase.done.toLocaleString()} / {phase.total.toLocaleString()}
          </p>
          <progress max={phase.total || 1} value={phase.done} />
        </div>
      )}

      {phase.name === 'log' && log && stats && (
        <main className="log">
          <aside className="sidebar">
            <section className="stats">
              <Stat value={stats.trips} label={stats.trips === 1 ? 'trip' : 'trips'} />
              <Stat value={stats.days} label="days away" />
              <Stat value={formatKm(stats.km)} label="travelled" />
              <Stat value={stats.countries || '–'} label={stats.countries === 1 ? 'country' : 'countries'} />
              <Stat value={stats.places} label="places" />
            </section>
            <p className="scan-summary">
              {phase.scan.photos.length.toLocaleString()} geotagged photos ({log.homePhotoCount.toLocaleString()} at home
              {log.home && geocoder.cached(log.home) ? ` in ${geocoder.cached(log.home)!.locality}` : ''}).
              {phase.scan.noLocation > 0 && ` ${phase.scan.noLocation.toLocaleString()} had no location.`}
              {phase.scan.noDate > 0 && ` ${phase.scan.noDate.toLocaleString()} had no date.`}
              {phase.scan.failed > 0 && ` ${phase.scan.failed.toLocaleString()} couldn’t be read.`}
            </p>
            <Settings
              options={options}
              onChange={setOptions}
              geocode={geocode}
              onGeocodeChange={setGeocode}
              homeOverridden={!!homeOverride}
              onResetHome={() => setHomeOverride(undefined)}
            />

            {trips.length === 0 ? (
              <p className="empty">
                {phase.scan.photos.length === 0
                  ? 'None of these photos have GPS location data. See the tips on the start screen for exports that keep it.'
                  : 'No trips found: every photo was taken near home. Try a smaller home radius in Settings.'}
              </p>
            ) : (
              <TripList
                trips={trips}
                selectedTripId={selectedTripId}
                onSelect={(id) => setSelectedTripId((cur) => (cur === id ? null : id))}
                onSetHome={(p) => {
                  setHomeOverride({ lat: p.lat, lon: p.lon });
                  setSelectedTripId(null);
                }}
              />
            )}
          </aside>
          <TravelMap
            home={log.home}
            trips={trips}
            selectedTripId={selectedTripId}
            onSelectTrip={(id) => {
              setSelectedTripId(id);
              document.getElementById(`trip-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }}
            geocoder={geocoder}
          />
        </main>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="stat">
      <b>{typeof value === 'number' ? value.toLocaleString() : value}</b>
      <span>{label}</span>
    </div>
  );
}

function TripList({
  trips,
  selectedTripId,
  onSelect,
  onSetHome,
}: {
  trips: Trip<Photo>[];
  selectedTripId: string | null;
  onSelect: (id: string) => void;
  onSetHome: (p: LatLon) => void;
}) {
  let year: number | null = null;
  return (
    <div className="trips">
      {trips.map((trip) => {
        const y = trip.start.getFullYear();
        const header = y !== year ? <h2 className="year">{y}</h2> : null;
        year = y;
        return (
          <div key={trip.id} id={`trip-${trip.id}`}>
            {header}
            <TripCard
              trip={trip}
              geocoder={geocoder}
              selected={trip.id === selectedTripId}
              onSelect={() => onSelect(trip.id)}
              onSetHome={onSetHome}
            />
          </div>
        );
      })}
    </div>
  );
}
