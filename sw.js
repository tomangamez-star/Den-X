const CACHE_NAME = "denx-animator-v050-layout-lock";

const APP_SHELL = [
  "./",
  "./index.html",
  "./project.html",
  "./open-project.html",
  "./settings.html",
  "./workspace.html",
  "./figure-creator.html",

  "./css/style.css",
  "./css/workspace-ui.css",
  "./css/project-ui.css",
  "./css/figure-creator.css",
  "./css/v0.3.3-quickdeck.css",
  "./css/v0.3.4-stability.css",
  "./css/tool-identity.css",
  "./css/toolbox-rebuild-v050.css",

  "./js/project-store.js",
  "./js/app.js",
  "./js/toolbox-rebuild-v050.js",
  "./js/segment-tools-v049.js",
  "./js/figure-copy-paste-v044.js",
  "./js/home-projects.js",
  "./js/open-projects.js",
  "./js/settings.js",
  "./js/project-setup.js",
  "./js/history.js",
  "./js/figure-library.js",
  "./js/tools.js",
  "./js/workspace-ui.js",
  "./js/text-objects.js",
  "./js/drawing.js",
  "./js/camera.js",
  "./js/bones.js",
  "./js/timeline.js",
  "./js/workspace-persistence.js",
  "./js/frame-export.js",
  "./js/video-export.js",
  "./js/node-interaction-v042.js",
  "./js/figure-creator.js",
  "./js/tool-identity.js",
  "./js/pwa.js",

  "./manifest.webmanifest",

  "./icons/icon-192.png",
  "./icons/icon-512.png",

  "./icons/ui/add-frame.svg",
  "./icons/ui/delete-frame.svg",
  "./icons/ui/copy.svg",
  "./icons/ui/paste.svg",
  "./icons/ui/play.svg",
  "./icons/ui/pause.svg",
  "./icons/ui/settings.svg",

  "./icons/tools/pan.svg",
  "./icons/tools/select.svg",
  "./icons/tools/background.svg",
  "./icons/tools/pencil.svg",
  "./icons/tools/text.svg",
  "./icons/tools/color.svg",
  "./icons/tools/eraser.svg",
  "./icons/tools/onion.svg",
  "./icons/tools/create-figure.svg",
  "./icons/tools/import-figure.svg",
  "./icons/tools/add-figure.svg",
  "./icons/tools/camera.svg",
  "./icons/tools/front.svg",
  "./icons/tools/back.svg",
  "./icons/tools/nav-back.svg"
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
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() =>
        caches.match(event.request)
          .then(cached =>
            cached || caches.match("./index.html")
          )
      )
  );
});
