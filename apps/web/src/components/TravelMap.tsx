import { useEffect } from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { latLngBounds } from 'leaflet';
import type { Geocoder, LatLon, Trip } from '@traveldiary/core';
import { formatDateRange, placeName, tripColor } from '../format';

interface Props {
  home: LatLon | null;
  trips: Trip[];
  selectedTripId: string | null;
  onSelectTrip: (id: string) => void;
  geocoder: Geocoder;
}

function FitBounds({ points }: { points: LatLon[] }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`).join('|');
  useEffect(() => {
    if (points.length === 0) return;
    const bounds = latLngBounds(points.map((p): [number, number] => [p.lat, p.lon]));
    map.flyToBounds(bounds, { padding: [40, 40], maxZoom: 11, duration: 0.8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

export function TravelMap({ home, trips, selectedTripId, onSelectTrip, geocoder }: Props) {
  const selected = trips.find((t) => t.id === selectedTripId);
  const focus: LatLon[] = selected ? selected.stops : [...(home ? [home] : []), ...trips.flatMap((t) => t.stops)];

  return (
    <MapContainer className="map" center={[20, 0]} zoom={2} worldCopyJump scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={focus} />
      {trips.map((trip) => {
        const color = tripColor(trip);
        const dim = selected && selected !== trip;
        return (
          <div key={trip.id}>
            {trip.stops.length > 1 && (
              <Polyline
                positions={trip.stops.map((s): [number, number] => [s.lat, s.lon])}
                pathOptions={{ color, weight: selected === trip ? 4 : 2.5, opacity: dim ? 0.2 : 0.85, dashArray: '6 6' }}
                eventHandlers={{ click: () => onSelectTrip(trip.id) }}
              />
            )}
            {trip.stops.map((stop) => (
              <CircleMarker
                key={stop.id}
                center={[stop.lat, stop.lon]}
                radius={5 + Math.min(10, Math.log2(stop.photos.length + 1) * 2)}
                pathOptions={{ color: '#fff', weight: 1.5, fillColor: color, fillOpacity: dim ? 0.25 : 0.95, opacity: dim ? 0.3 : 1 }}
                eventHandlers={{ click: () => onSelectTrip(trip.id) }}
              >
                <Tooltip>
                  <b>{placeName(geocoder.cached(stop), stop)}</b>
                  <br />
                  {formatDateRange(stop.arrivedAt, stop.leftAt)} · {stop.photos.length} photos
                </Tooltip>
              </CircleMarker>
            ))}
          </div>
        );
      })}
      {home && (
        <CircleMarker
          center={[home.lat, home.lon]}
          radius={9}
          pathOptions={{ color: '#111', weight: 3, fillColor: '#fff', fillOpacity: 1 }}
        >
          <Tooltip permanent direction="top" offset={[0, -8]}>
            🏠 Home
          </Tooltip>
        </CircleMarker>
      )}
    </MapContainer>
  );
}
