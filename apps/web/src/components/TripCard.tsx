import type { CSSProperties } from 'react';
import { flagEmoji, type Geocoder, type LatLon, type Place, type Trip } from '@traveldiary/core';
import { formatDateRange, formatKm, placeName, tripTitle, TRIP_COLORS } from '../format';
import type { Photo } from '../scan';
import { Thumb } from '../Thumb';

const MAX_THUMBS = 12;

/** "Region, Country", skipping parts that just repeat the locality. */
const placeContext = (place: Place) =>
  [...new Set([place.region, place.country])].filter((x) => x && x !== place.locality).join(', ');

interface Props {
  trip: Trip<Photo>;
  geocoder: Geocoder;
  selected: boolean;
  onSelect: () => void;
  onSetHome: (point: LatLon) => void;
}

export function TripCard({ trip, geocoder, selected, onSelect, onSetHome }: Props) {
  const color = TRIP_COLORS[Number(trip.id.slice(1)) % TRIP_COLORS.length];
  return (
    <article className={`trip${selected ? ' selected' : ''}`} style={{ '--trip-color': color } as CSSProperties}>
      <button className="trip-header" onClick={onSelect} aria-expanded={selected}>
        <span className="trip-title">{tripTitle(trip, geocoder)}</span>
        <span className="trip-meta">
          {formatDateRange(trip.start, trip.end)} · {trip.days} {trip.days === 1 ? 'day' : 'days'} ·{' '}
          {trip.stops.length} {trip.stops.length === 1 ? 'stop' : 'stops'} · {trip.photoCount} photos
          {trip.distanceKm >= 1 && <> · {formatKm(trip.distanceKm)}</>}
        </span>
      </button>

      {selected && (
        <ol className="stops">
          {trip.stops.map((stop) => {
            const place = geocoder.cached(stop);
            return (
              <li key={stop.id} className="stop">
                <div className="stop-head">
                  <div>
                    <div className="stop-name">
                      {flagEmoji(place?.countryCode)} {placeName(place, stop)}
                      {place && <span className="stop-country">{placeContext(place)}</span>}
                    </div>
                    <div className="stop-meta">
                      {formatDateRange(stop.arrivedAt, stop.leftAt)} · {stop.photos.length} photos
                    </div>
                  </div>
                  <button className="link" onClick={() => onSetHome(stop)} title="Use this place as home">
                    Set as home
                  </button>
                </div>
                <div className="thumbs">
                  {stop.photos.slice(0, MAX_THUMBS).map((p) => (
                    <Thumb key={p.id} photo={p} />
                  ))}
                  {stop.photos.length > MAX_THUMBS && <div className="thumb thumb-more">+{stop.photos.length - MAX_THUMBS}</div>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </article>
  );
}
