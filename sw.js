const CACHE_NAME = "denx-animator-v14-import-dialog-camera-thumbs";
const APP_SHELL = [
  "./",
  "./index.html",
  "./project.html",
  "./workspace.html",
  "./figure-creator.html",
  "./css/style.css",
  "./css/workspace-ui.css",
  "./css/figure-creator.css",
  "./js/app.js",
  "./js/history.js",
  "./js/figure-library.js",
  "./js/tools.js",
  "./js/workspace-ui.js",
  "./js/drawing.js",
  "./js/camera.js",
  "./js/bones.js",
  "./js/timeline.js",
  "./js/workspace-persistence.js",
  "./js/figure-creator.js",
  "./js/pwa.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match("./index.html")))
  );
});
