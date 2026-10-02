# 🧭 Travel Diary

Turns your photo gallery into a travel log. Point it at a folder of photos and it reads the GPS
location and capture date from each photo's EXIF data, works out where home is, and groups
everything else into **trips** and **stops**. These are shown on a map and a timeline with place names, dates,
distances and thumbnails.

## Privacy

Photos never leave your device; your browser reads them directly. The only network calls are:

- **Map tiles** from OpenStreetMap.
- **Place names**: the centre coordinates of each *stop* (not your photos) are sent to
  [Nominatim](https://nominatim.org/) to turn them into "Lisbon, Portugal". You can switch this off
  in Settings. Results are cached in your browser so re-scanning is instant.

## Google Maps

- **Open in Google Maps**: every trip has a link that opens its route through all its stops, and
  every stop has a link to its location. Both work in the browser or the Google Maps app, with
  no API key. Google route links allow at most 9 stops in between, so longer trips are thinned out
  evenly (start and end are always kept). Google may show no driving route across the sea
  (e.g. London → Rome), but the stops are still plotted.
- **Export for Google My Maps**: downloads a `.kml` file with your home, every stop, and each trip's
  route, one folder per trip, coloured the same as in the app. To keep it in your Google account:
  [mymaps.google.com](https://mymaps.google.com) → **Create a new map** → **Import** → choose the
  file. It also opens in Google Earth.

## Getting your photos with location intact

Many sharing paths strip GPS data. These keep it:

| Source | How |
| --- | --- |
| Google Photos | [Google Takeout](https://takeout.google.com) → Google Photos, then unzip |
| iPhone / iCloud | Photos on Mac → select → File → Export → **Export Unmodified Original** |
| Android / iPhone | Copy the camera roll (`DCIM`) to your computer over USB |

Picking photos in a *phone* browser usually removes location data, which is why a native mobile app is
on the roadmap (see below).

## How trips are detected

All in [`packages/core/src/trips.ts`](packages/core/src/trips.ts), as pure functions:

1. **Home** is the ~25 km area where you took photos on the most *distinct days*, so a 500-photo
   holiday doesn't outvote everyday life. You can override it with "Set as home" on any stop.
2. Photos are walked in time order. A photo **near home** (default 50 km) ends the current trip.
   A **gap** of more than 3 days between away photos also starts a new trip.
3. Within a trip, consecutive photos within 25 km of each other form a **stop**. A → B → A stays
   three stops, since that's the real itinerary.
4. Trips with fewer than 2 photos are dropped as noise.

All of these thresholds can be changed live in the app's Settings panel.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests for the core logic
npm run typecheck
npm run build      # static site in apps/web/dist, can be hosted anywhere
```

## Project layout

```
packages/core   @traveldiary/core: platform-independent logic (no DOM, no Node APIs)
  geo.ts          distances, centroids, coordinate validation
  trips.ts        home detection, trip & stop clustering
  geocode.ts      Nominatim reverse geocoder with throttling + pluggable cache store
  describe.ts     trip titles ("🇫🇷 Paris → Lyon"), place names, trip colours
  googleMaps.ts   Google Maps place/route links and KML export
apps/web        Vite + React app
  scan.ts         reads EXIF (exifr) from File objects, 8 at a time; HEIC thumbnails via embedded preview
  App.tsx         pick → scan → log
  components/     map (Leaflet), trip cards, settings, picker
```

## Roadmap: native mobile app

`@traveldiary/core` was kept free of browser APIs so an Expo / React Native app can reuse it as is:

- Read the gallery with `expo-media-library` (`getAssetsAsync`, then `getAssetInfoAsync(asset).location`
  and `creationTime`). On Android this needs the `ACCESS_MEDIA_LOCATION` permission, or locations come
  back redacted.
- Map each asset to `{ id, lat, lon, takenAt }` and call `buildTravelLog`.
- Create `new Geocoder({ store: AsyncStorage })` for cached place names.
