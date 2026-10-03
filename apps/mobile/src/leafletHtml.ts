/** Data the native side sends to the map page. */
export interface MapData {
  home: { lat: number; lon: number; name: string } | null;
  trips: {
    id: string;
    color: string;
    stops: { lat: number; lon: number; name: string; detail: string }[];
  }[];
  selectedTripId: string | null;
  dark: boolean;
}

/** Messages the map page sends back. */
export type MapMessage = { type: 'ready' } | { type: 'select'; tripId: string };

const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist';

/**
 * A self-contained Leaflet page. The app calls `window.render(data)` (via injectJavaScript) whenever
 * the trips or selection change; taps on stops come back through ReactNativeWebView.postMessage.
 */
export const leafletHtml = `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="${LEAFLET}/leaflet.css">
<script src="${LEAFLET}/leaflet.js"></script>
<style>
  html, body, #map { margin: 0; height: 100%; background: #e9e6df; }
  body.dark, body.dark #map { background: #1f201d; }
  body.dark .leaflet-tile-pane { filter: brightness(0.75) contrast(1.1) saturate(0.8); }
  .leaflet-tooltip { font: 13px system-ui, sans-serif; }
  #offline { position: absolute; inset: 0; display: none; align-items: center; justify-content: center;
    font: 14px system-ui, sans-serif; color: #6b665d; text-align: center; padding: 24px; }
</style>
</head>
<body>
<div id="map"></div>
<div id="offline">Map unavailable offline.<br>Your trips are listed below.</div>
<script>
(function () {
  function post(msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  }
  if (!window.L) {
    document.getElementById('offline').style.display = 'flex';
    window.render = function () {};
    post({ type: 'ready' });
    return;
  }
  var map = L.map('map', { zoomControl: false, worldCopyJump: true, attributionControl: true }).setView([20, 0], 2);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  var layer = L.layerGroup().addTo(map);
  var lastFit = '';

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  window.render = function (data) {
    document.body.classList.toggle('dark', !!data.dark);
    layer.clearLayers();
    var selected = null;
    data.trips.forEach(function (t) { if (t.id === data.selectedTripId) selected = t; });
    var focus = [];

    data.trips.forEach(function (trip) {
      var dim = selected && selected !== trip;
      var latlngs = trip.stops.map(function (s) { return [s.lat, s.lon]; });
      if (latlngs.length > 1) {
        L.polyline(latlngs, { color: trip.color, weight: selected === trip ? 4 : 2.5, opacity: dim ? 0.2 : 0.85, dashArray: '6 6' })
          .on('click', function () { post({ type: 'select', tripId: trip.id }); })
          .addTo(layer);
      }
      trip.stops.forEach(function (s) {
        L.circleMarker([s.lat, s.lon], { radius: 7, color: '#fff', weight: 1.5, fillColor: trip.color, fillOpacity: dim ? 0.25 : 0.95, opacity: dim ? 0.3 : 1 })
          .bindTooltip('<b>' + esc(s.name) + '</b><br>' + esc(s.detail))
          .on('click', function () { post({ type: 'select', tripId: trip.id }); })
          .addTo(layer);
        if (!selected || selected === trip) focus.push([s.lat, s.lon]);
      });
    });

    if (data.home) {
      L.circleMarker([data.home.lat, data.home.lon], { radius: 8, color: '#111', weight: 3, fillColor: '#fff', fillOpacity: 1 })
        .bindTooltip('🏠 ' + esc(data.home.name))
        .addTo(layer);
      if (!selected) focus.push([data.home.lat, data.home.lon]);
    }

    var key = JSON.stringify(focus);
    if (focus.length && key !== lastFit) {
      lastFit = key;
      map.flyToBounds(L.latLngBounds(focus), { padding: [30, 30], maxZoom: 11, duration: 0.6 });
    }
  };
  post({ type: 'ready' });
})();
</script>
</body>
</html>`;
