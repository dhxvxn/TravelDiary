import { memo } from 'react';
import { FlatList, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  flagEmoji,
  googleMapsPlaceUrl,
  googleMapsRouteUrl,
  placeName,
  tripColor,
  tripTitle,
  type Geocoder,
  type LatLon,
  type Place,
  type Trip,
} from '@traveldiary/core';
import type { Photo } from '../scanCache';
import { formatDateRange, formatKm, plural } from '../format';
import type { Theme } from '../theme';

const MAX_THUMBS = 20;

interface Props {
  trip: Trip<Photo>;
  geocoder: Geocoder;
  /** Changes when new place names arrive, so memoised rows re-render. */
  placesVersion: number;
  selected: boolean;
  onPress: () => void;
  onSetHome: (p: LatLon) => void;
  theme: Theme;
}

const placeContext = (place?: Place) =>
  place ? [...new Set([place.region, place.country])].filter((x) => x && x !== place.locality).join(', ') : '';

function TripItemImpl({ trip, geocoder, selected, onPress, onSetHome, theme }: Props) {
  const color = tripColor(trip);
  const s = makeStyles(theme);
  const open = (url: string) => Linking.openURL(url).catch(() => undefined);

  return (
    <View style={[s.card, { borderLeftColor: color }, selected && { borderColor: color }]}>
      <Pressable onPress={onPress} android_ripple={{ color: theme.surface2 }} style={s.header} accessibilityRole="button" accessibilityState={{ expanded: selected }}>
        <Text style={s.title}>{tripTitle(trip, (p) => geocoder.cached(p))}</Text>
        <Text style={s.meta}>
          {formatDateRange(trip.start, trip.end)} · {plural(trip.days, 'day')} · {plural(trip.stops.length, 'stop')} ·{' '}
          {plural(trip.photoCount, 'photo')}
          {trip.distanceKm >= 1 ? ` · ${formatKm(trip.distanceKm)}` : ''}
        </Text>
      </Pressable>
      <Pressable onPress={() => open(googleMapsRouteUrl(trip.stops))} hitSlop={8} style={s.linkRow}>
        <Text style={s.link}>{trip.stops.length > 1 ? 'Open route in Google Maps ↗' : 'Open in Google Maps ↗'}</Text>
      </Pressable>

      {selected &&
        trip.stops.map((stop, i) => {
          const place = geocoder.cached(stop);
          return (
            <View key={stop.id} style={s.stop}>
              <View style={s.stopHead}>
                <View style={{ flex: 1 }}>
                  <Text style={s.stopName}>
                    <Text style={s.muted}>{i + 1}. </Text>
                    {flagEmoji(place?.countryCode)} {placeName(place, stop)}
                    {placeContext(place) ? <Text style={s.stopContext}>  {placeContext(place)}</Text> : null}
                  </Text>
                  <Text style={s.meta}>
                    {formatDateRange(stop.arrivedAt, stop.leftAt)} · {plural(stop.photos.length, 'photo')}
                  </Text>
                </View>
                <View style={s.stopActions}>
                  <Pressable onPress={() => open(googleMapsPlaceUrl(stop))} hitSlop={6}>
                    <Text style={s.link}>Google Maps ↗</Text>
                  </Pressable>
                  <Pressable onPress={() => onSetHome(stop)} hitSlop={6}>
                    <Text style={s.link}>Set as home</Text>
                  </Pressable>
                </View>
              </View>
              <FlatList
                horizontal
                data={stop.photos.slice(0, MAX_THUMBS)}
                keyExtractor={(p) => p.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 4 }}
                renderItem={({ item }) => (
                  <Image source={{ uri: item.uri }} style={s.thumb} resizeMethod="resize" accessibilityLabel={`Photo from ${item.takenAt.toDateString()}`} />
                )}
                ListFooterComponent={
                  stop.photos.length > MAX_THUMBS ? (
                    <View style={[s.thumb, s.more]}>
                      <Text style={s.muted}>+{stop.photos.length - MAX_THUMBS}</Text>
                    </View>
                  ) : null
                }
              />
            </View>
          );
        })}
    </View>
  );
}

export const TripItem = memo(TripItemImpl);

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: t.surface,
      borderColor: t.border,
      borderWidth: 1,
      borderLeftWidth: 4,
      borderRadius: 12,
      marginHorizontal: 16,
      marginBottom: 10,
      overflow: 'hidden',
    },
    header: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4, gap: 2 },
    title: { color: t.text, fontSize: 16, fontWeight: '700' },
    meta: { color: t.muted, fontSize: 13 },
    muted: { color: t.muted },
    linkRow: { paddingHorizontal: 14, paddingBottom: 12, paddingTop: 4, alignSelf: 'flex-start' },
    link: { color: t.accent, fontSize: 13, fontWeight: '600' },
    stop: { borderTopWidth: 1, borderTopColor: t.border, marginHorizontal: 14, paddingVertical: 12, gap: 8 },
    stopHead: { flexDirection: 'row', gap: 8 },
    stopName: { color: t.text, fontSize: 15, fontWeight: '600' },
    stopContext: { color: t.muted, fontSize: 13, fontWeight: '400' },
    stopActions: { alignItems: 'flex-end', gap: 6 },
    thumb: { width: 72, height: 72, borderRadius: 6, backgroundColor: t.surface2 },
    more: { alignItems: 'center', justifyContent: 'center' },
  });
