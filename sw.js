// SatLedger service worker — offline support and CDN asset caching
const CACHE_NAME = 'satledger-v3';

// Split so one unreachable URL can't silently disable offline support entirely.
// cache.addAll() is atomic: a blocked unpkg (corporate proxy, DNS filter, ad blocker) used to
// reject the whole install, so the worker never activated and nothing was ever cached.
// CRITICAL stays atomic on purpose — if app.html can't be fetched, the install SHOULD fail.
const CRITICAL_URLS = [
  './',
  './index.html',
  './app.html',
  './manifest.json',
  './images/favicon-32.png',
  './images/icon-192.png',
];

// Nice to have offline, but never worth failing the install over. Each is added individually.
const OPTIONAL_URLS = [
  './privacy.html',
  './terms.html',
  './images/apple-touch-icon.png',
  './images/icon-512.png',
  './images/logo-dark-128.png',
  './images/logo-white-128.png',
  './images/tip-lightning.png',
  './images/tip-onchain.png',
  // Pinned CDN scripts — immutable, safe to cache forever (SRI still verified on use)
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone@7.29.7/babel.min.js',
];

// Hosts the SW must never intercept: live data and auth flows
const NETWORK_ONLY_HOSTS = [
  'api.coinbase.com',
  'api.exchange.coinbase.com',
  'www.googleapis.com',
  'oauth2.googleapis.com',
  'accounts.google.com',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CRITICAL_URLS)
        .then(() => Promise.allSettled(
          OPTIONAL_URLS.map(u => cache.add(u).catch(err => {
            console.warn('[SW] optional precache skipped:', u, err && err.message);
          }))
        ))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (NETWORK_ONLY_HOSTS.includes(url.hostname)) return;

  // App pages: network-first so deploys propagate, cache fallback for offline
  if (url.origin === self.location.origin && (req.mode === 'navigate' || url.pathname.endsWith('.html'))) {
    event.respondWith(
      fetch(req)
        .then(resp => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          return resp;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }))
    );
    return;
  }

  // Everything else cacheable (pinned CDN scripts, fonts, images): cache-first
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(resp => {
        const cacheable = resp.ok || resp.type === 'opaque';
        const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
        if (cacheable && (url.origin === self.location.origin || url.hostname === 'unpkg.com' || isFont)) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return resp;
      });
    })
  );
});
