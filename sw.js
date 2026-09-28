/* =========================================================
   Sri Viswa School – Service Worker (PWA offline support)
   ========================================================= */

const CACHE_NAME = "svs-cache-v1";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/logo.png",
  "./assets/favicon.png",
  "./assets/school-entrance.jpg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png"
];

/* ---------- Install: pre-cache core assets ---------- */
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // cache each asset individually so one missing file doesn't break install
        return Promise.all(
          CORE_ASSETS.map(url =>
            cache.add(url).catch(() => {
              console.warn("[SW] Skipped caching:", url);
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

/* ---------- Activate: clean old caches ---------- */
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ---------- Fetch: cache-first with network fallback ---------- */
self.addEventListener("fetch", event => {
  const req = event.request;

  // Only handle GET requests
  if (req.method !== "GET") return;

  // Skip cross-origin (Google Fonts, Bootstrap CDN, etc.)
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  // Handle navigation requests (page loads)
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Handle static assets
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;

      return fetch(req).then(res => {
        // Only cache successful same-origin responses
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => {
        // Offline fallback for images
        if (req.destination === "image") {
          return caches.match("./assets/logo.png");
        }
      });
    })
  );
});

/* ---------- Message: force update ---------- */
self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
