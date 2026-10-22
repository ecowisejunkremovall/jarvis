/* EcoWise service worker: fast repeat visits + offline fallback.
   HTML is network-first (new deploys show right away); images are cache-first;
   AI / booking functions are never cached. */
const V = 'ecowise-v4';
const CORE = ['/', '/logo-192.webp', '/icon-192.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/.netlify/')) return;
  if (r.mode === 'navigate') {
    e.respondWith(fetch(r).then(res => { if (res.ok) { const c = res.clone(); caches.open(V).then(x => x.put(u.pathname, c)); } return res; })
      .catch(() => caches.match(u.pathname).then(hit => hit || caches.match('/'))));
    return;
  }
  if (/\.(webp|png|jpg|svg|woff2?)$/.test(u.pathname)) {
    e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => {
      if (res.ok) { const c = res.clone(); caches.open(V).then(x => x.put(r, c)); } return res; })));
  }
});
