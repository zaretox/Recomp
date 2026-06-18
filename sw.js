const CACHE = 'recomp-v1';

const CDN_ASSETS = [
  'https://unpkg.com/react@18.2.0/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18.2.0/umd/react-dom.production.min.js',
  'https://unpkg.com/prop-types@15.8.1/prop-types.min.js',
  'https://unpkg.com/recharts@2.12.7/umd/Recharts.min.js',
  'https://unpkg.com/@babel/standalone@7.24.7/babel.min.js',
];

/* Installation : pré-cache le shell + CDN */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(async cache => {
      // App shell (toujours depuis l'origine)
      await cache.add('/');
      // CDN : on essaie de pré-cacher mais on ne bloque pas si offline
      for (const url of CDN_ASSETS) {
        try { await cache.add(url); } catch (_) {}
      }
    })
  );
  self.skipWaiting();
});

/* Activation : nettoie les anciens caches */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* Fetch : cache-first pour les assets CDN, network-first pour le reste */
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Assets CDN : cache-first (ils ne changent jamais)
  if (CDN_ASSETS.some(a => url.startsWith(a.split('@')[0]))) {
    e.respondWith(
      caches.match(e.request).then(hit => {
        if (hit) return hit;
        return fetch(e.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        });
      })
    );
    return;
  }

  // App shell : network-first avec fallback cache
  if (e.request.mode === 'navigate' || url.includes(self.location.origin)) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }
});
