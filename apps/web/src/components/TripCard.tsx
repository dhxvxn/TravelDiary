import type { CSSProperties } from 'react';
import { flagEmoji, googleMapsPlaceUrl, googleMapsRouteUrl, type Geocoder, type LatLon, type Place, type Trip } from '@traveldiary/core';
import { formatDateRange, formatKm, placeName, tripColor, tripTitle } from '../format';
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
  const color = tripColor(trip);
  return (
    <article className={`trip${selected ? ' selected' : ''}`} style={{ '--trip-color': color } as CSSProperties}>
      <button className="trip-header" onClick={onSelect} aria-expanded={selected}>
        <span className="trip-title">{tripTitle(trip, (p) => geocoder.cached(p))}</span>
        <span className="trip-meta">
          {formatDateRange(trip.start, trip.end)} · {trip.days} {trip.days === 1 ? 'day' : 'days'} ·{' '}
          {trip.stops.length} {trip.stops.length === 1 ? 'stop' : 'stops'} · {trip.photoCount} photos
          {trip.distanceKm >= 1 && <> · {formatKm(trip.distanceKm)}</>}
        </span>
      </button>
      <a className="gmaps trip-gmaps" href={googleMapsRouteUrl(trip.stops)} target="_blank" rel="noopener noreferrer">
        {trip.stops.length > 1 ? 'Open route in Google Maps' : 'Open in Google Maps'} ↗
      </a>

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
                  <div className="stop-actions">
                    <a className="gmaps" href={googleMapsPlaceUrl(stop)} target="_blank" rel="noopener noreferrer">
                      Google Maps ↗
                    </a>
                    <button className="link" onClick={() => onSetHome(stop)} title="Use this place as home">
                      Set as home
                    </button>
                  </div>
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
