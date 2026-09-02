/* Anchor service worker — network-first so updates show up right away,
   with the cache as an offline fallback */
const CACHE = "anchor-v14";
const ASSETS = [
  ".",
  "index.html",
  "privacy.html",
  "terms.html",
  "style.css",
  "i18n/en.js",
  "i18n/de.js",
  "i18n/i18n.js",
  "storage.js",
  "backup.js",
  "app.js",
  "manifest.json",
  "manifest.de.json",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && new URL(e.request.url).origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request, { ignoreSearch: true }).then(
          (cached) => cached || Response.error()
        )
      )
  );
});
