import { centroid, haversineKm, type LatLon } from './geo';

export interface GeoPhoto extends LatLon {
  id: string;
  takenAt: Date;
}

export interface Stop<P extends GeoPhoto = GeoPhoto> extends LatLon {
  id: string;
  photos: P[];
  arrivedAt: Date;
  leftAt: Date;
}

export interface Trip<P extends GeoPhoto = GeoPhoto> {
  id: string;
  stops: Stop<P>[];
  start: Date;
  end: Date;
  /** Calendar days touched by the trip (a same-day trip counts as 1). */
  days: number;
  photoCount: number;
  /** Distance travelled between consecutive stops, in km. */
  distanceKm: number;
  /** Furthest distance from home reached on this trip, in km. */
  maxDistanceFromHomeKm: number;
}

export interface TripOptions {
  /** Photos within this distance of home are considered "at home". */
  homeRadiusKm: number;
  /** A gap longer than this between away photos splits them into separate trips. */
  maxGapDays: number;
  /** Consecutive photos within this distance of a stop's centre belong to that stop. */
  stopRadiusKm: number;
  /** Trips with fewer photos than this are dropped as noise. */
  minPhotosPerTrip: number;
  /** Override automatic home detection. */
  home?: LatLon;
}

export const DEFAULT_OPTIONS: TripOptions = {
  homeRadiusKm: 50,
  maxGapDays: 3,
  stopRadiusKm: 25,
  minPhotosPerTrip: 2,
};

const DAY_MS = 24 * 60 * 60 * 1000;
const HOME_CELL_DEG = 0.25;

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/**
 * Guess where home is: the ~25 km grid cell in which photos were taken on the most distinct days.
 * Counting days rather than photos stops a single 500-photo holiday from outvoting everyday life.
 */
export function detectHome(photos: GeoPhoto[]): LatLon | null {
  if (photos.length === 0) return null;
  const cells = new Map<string, { days: Set<string>; photos: GeoPhoto[] }>();
  for (const p of photos) {
    const key = `${Math.floor(p.lat / HOME_CELL_DEG)}:${Math.floor(p.lon / HOME_CELL_DEG)}`;
    let cell = cells.get(key);
    if (!cell) {
      cell = { days: new Set(), photos: [] };
      cells.set(key, cell);
    }
    cell.days.add(dayKey(p.takenAt));
    cell.photos.push(p);
  }
  let best: { days: Set<string>; photos: GeoPhoto[] } | undefined;
  for (const cell of cells.values()) {
    if (
      !best ||
      cell.days.size > best.days.size ||
      (cell.days.size === best.days.size && cell.photos.length > best.photos.length)
    ) {
      best = cell;
    }
  }
  return centroid(best!.photos);
}

function countDays(start: Date, end: Date): number {
  const a = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const b = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((b - a) / DAY_MS) + 1;
}

function buildStops<P extends GeoPhoto>(photos: P[], stopRadiusKm: number, tripId: string): Stop<P>[] {
  const stops: Stop<P>[] = [];
  let current: P[] = [];
  let center: LatLon | null = null;

  const flush = () => {
    if (current.length === 0) return;
    stops.push({
      id: `${tripId}-s${stops.length}`,
      ...centroid(current),
      photos: current,
      arrivedAt: current[0].takenAt,
      leftAt: current[current.length - 1].takenAt,
    });
  };

  for (const p of photos) {
    if (center && haversineKm(center, p) <= stopRadiusKm) {
      current.push(p);
      center = centroid(current);
    } else {
      flush();
      current = [p];
      center = { lat: p.lat, lon: p.lon };
    }
  }
  flush();
  return stops;
}

function finishTrip<P extends GeoPhoto>(photos: P[], home: LatLon, opts: TripOptions, index: number): Trip<P> {
  const id = `t${index}`;
  const stops = buildStops(photos, opts.stopRadiusKm, id);
  let distanceKm = 0;
  for (let i = 1; i < stops.length; i++) distanceKm += haversineKm(stops[i - 1], stops[i]);
  const start = photos[0].takenAt;
  const end = photos[photos.length - 1].takenAt;
  return {
    id,
    stops,
    start,
    end,
    days: countDays(start, end),
    photoCount: photos.length,
    distanceKm,
    maxDistanceFromHomeKm: Math.max(...stops.map((s) => haversineKm(home, s))),
  };
}

export interface TravelLog<P extends GeoPhoto = GeoPhoto> {
  home: LatLon | null;
  trips: Trip<P>[];
  homePhotoCount: number;
}

/**
 * Turn a pile of geotagged photos into a list of trips.
 *
 * Photos are walked in time order. Anything taken near home ends the current trip; anything away
 * from home extends it, unless the previous away photo was more than `maxGapDays` ago (you probably
 * went home and just didn't take pictures there).
 */
export function buildTravelLog<P extends GeoPhoto>(photos: P[], options: Partial<TripOptions> = {}): TravelLog<P> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const sorted = [...photos].sort((a, b) => a.takenAt.getTime() - b.takenAt.getTime());
  const home = opts.home ?? detectHome(sorted);
  if (!home) return { home: null, trips: [], homePhotoCount: 0 };

  const groups: P[][] = [];
  let current: P[] = [];
  let homePhotoCount = 0;
  const close = () => {
    if (current.length > 0) groups.push(current);
    current = [];
  };

  for (const p of sorted) {
    if (haversineKm(home, p) <= opts.homeRadiusKm) {
      homePhotoCount++;
      close();
      continue;
    }
    const last = current[current.length - 1];
    if (last && p.takenAt.getTime() - last.takenAt.getTime() > opts.maxGapDays * DAY_MS) close();
    current.push(p);
  }
  close();

  const trips = groups
    .filter((g) => g.length >= opts.minPhotosPerTrip)
    .map((g, i) => finishTrip(g, home, opts, i));
  return { home, trips, homePhotoCount };
}
