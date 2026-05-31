/* ============== EaseTrack — Service Worker ============== */
// Cache-first strategy for the app shell. Network is only consulted for
// resources missing from the cache (e.g. the Chart.js CDN on first run).

const CACHE = 'easetrack-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/storage.js',
  './js/charts.js',
  './js/reminders.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))
      .catch(err => console.warn('SW install partial cache failure:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(resp => {
        // Only cache same-origin or our whitelisted CDN.
        const url = new URL(event.request.url);
        const sameOrigin = url.origin === self.location.origin;
        const isCdn = url.host === 'cdn.jsdelivr.net';
        if (resp && resp.status === 200 && (sameOrigin || isCdn)) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(event.request, clone));
        }
        return resp;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
