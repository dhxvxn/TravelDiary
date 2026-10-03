import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { placeName, tripColor, type Geocoder, type LatLon, type Trip } from '@traveldiary/core';
import { leafletHtml, type MapData, type MapMessage } from '../leafletHtml';
import { formatDateRange, plural } from '../format';
import type { Theme } from '../theme';

interface Props {
  home: LatLon | null;
  trips: Trip[];
  selectedTripId: string | null;
  onSelectTrip: (id: string) => void;
  geocoder: Geocoder;
  placesVersion: number;
  theme: Theme;
}

export function TravelMap({ home, trips, selectedTripId, onSelectTrip, geocoder, placesVersion, theme }: Props) {
  const webview = useRef<WebView>(null);
  const [ready, setReady] = useState(false);

  const data = useMemo<MapData>(
    () => ({
      home: home && { ...home, name: placeName(geocoder.cached(home), home) },
      trips: trips.map((t) => ({
        id: t.id,
        color: tripColor(t),
        stops: t.stops.map((s) => ({
          lat: s.lat,
          lon: s.lon,
          name: placeName(geocoder.cached(s), s),
          detail: `${formatDateRange(s.arrivedAt, s.leftAt)} · ${plural(s.photos.length, 'photo')}`,
        })),
      })),
      selectedTripId,
      dark: theme.dark,
    }),
    // placesVersion: re-read names from the geocoder cache when new ones arrive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [home, trips, selectedTripId, theme.dark, placesVersion],
  );

  useEffect(() => {
    if (ready) webview.current?.injectJavaScript(`window.render(${JSON.stringify(data)}); true;`);
  }, [ready, data]);

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: MapMessage;
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'ready') setReady(true);
    else if (msg.type === 'select') onSelectTrip(msg.tripId);
  };

  return (
    <View style={[styles.wrap, { backgroundColor: theme.surface2 }]}>
      <WebView
        ref={webview}
        // A real https base URL gives tile requests a Referer, which OpenStreetMap's tile policy requires.
        source={{ html: leafletHtml, baseUrl: 'https://traveldiary.app/' }}
        originWhitelist={['*']}
        onMessage={onMessage}
        onLoadStart={() => setReady(false)}
        style={styles.web}
        setSupportMultipleWindows={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden' },
  web: { flex: 1, backgroundColor: 'transparent' },
});
