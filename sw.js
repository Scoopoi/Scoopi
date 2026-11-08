// Service worker: gemmer app-filerne, så appen virker offline.
// Hæv versionsnummeret, når filerne ændres, så telefonen henter de nye.
const CACHE = 'fiske-app-v32';
const FILES = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/config.js',
  './js/konto.js',
  './js/adgang.js',
  './vendor/supabase/supabase.js',
  './js/db.js',
  './js/ture.js',
  './js/fisk.js',
  './js/exif.js',
  './js/fangster.js',
  './js/kendte.js',
  './js/album.js',
  './js/statistik.js',
  './js/drone.js',
  './js/dji.js',
  './js/karpefinder.js',
  './js/karpemodel.js',
  './js/sokort.js',
  './js/kortvaelger.js',
  './js/kort.js',
  './vendor/leaflet/leaflet.js',
  './vendor/leaflet/leaflet.css',
  './js/util.js',
  './js/vejr.js',
  './manifest.webmanifest',
  './img/hero.jpg',
  './img/skael.jpg',
  './img/skael-tile.jpg',
  './img/logo.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Kun egne filer caches. Kald til fx Open-Meteo og GitHub går altid på nettet.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    // no-cache: spørg altid serveren, om filen er ændret (GitHub Pages cacher ellers i 10 min)
    fetch(e.request, { cache: 'no-cache' })
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html')))
  );
});
