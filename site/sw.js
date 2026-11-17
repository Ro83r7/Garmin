/* Service Worker: macht das Dashboard offline lesbar (z. B. im Flugzeug oder als iPhone-Web-App ohne Netz).
   Strategie: immer zuerst das Netz, nur bei fehlendem Netz der zuletzt geladene Stand aus dem Cache.
   Weiterleitungen (z. B. Anmeldung über Cloudflare Access) und Fehlerantworten werden nie zwischengespeichert. */
const CACHE = 'garmin-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok && res.type === 'basic' && !res.redirected) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || Response.error()))
  );
});
