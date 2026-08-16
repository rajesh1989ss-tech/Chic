const CACHE = "chic-v4";
const SHELL = "./";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png"
];

// Cache each asset on its own: with cache.addAll a single failure rejects the
// whole batch and leaves an empty cache, which breaks the offline start_url
// check Chrome runs before it will offer "Install".
async function precache() {
  const cache = await caches.open(CACHE);
  await Promise.all(ASSETS.map(url =>
    cache.add(new Request(url, { cache: "reload" }))
      .catch(err => console.warn("[Chic sw] could not precache", url, err))
  ));
}

self.addEventListener("install", e => {
  e.waitUntil(precache());
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== location.origin) return;

  // Navigations: try the network, fall back to the cached app shell so the
  // start_url still resolves with a 200 while offline.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then(r => {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return r;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE);
          return (await cache.match(req, { ignoreSearch: true }))
              || (await cache.match(SHELL))
              || (await cache.match("./index.html"))
              || new Response("Chic is offline.", {
                   status: 200,
                   headers: { "Content-Type": "text/html; charset=utf-8" }
                 });
        })
    );
    return;
  }

  e.respondWith(
    fetch(req)
      .then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return r;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })
        .then(m => m || Response.error()))
  );
});
