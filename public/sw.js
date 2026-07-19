/**
 * Service worker for offline support.
 *
 * Face detection runs via a Worker (workers/faceDetection.worker.ts) on
 * MediaPipe's FaceDetector, with the WASM runtime, .task model, and Twemoji
 * SVGs self-hosted under /mediapipe/, /models/, and /emoji/. All image
 * processing happens on-device, and all static assets ship with the app —
 * the only network dependency is the initial page load. Caching them lets
 * the app keep working fully offline.
 *
 * Bump CACHE_VERSION whenever precached assets change so old caches are
 * dropped on activate instead of accumulating forever.
 */
const CACHE_VERSION = 'v5';
const CACHE_NAME = `no-face-${CACHE_VERSION}`;

// Model and wasm files are NOT precached here — they're multi-megabyte and
// addAll fails the whole install if any one entry 404s. They're instead
// filled in lazily by the runtime cacheFirst handler below on first request.
const APP_SHELL = ['/', '/site.webmanifest', '/kaonashi.jpg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

/** Cache-first: for content that never changes once fetched (models, Twemoji, hashed Next.js assets). */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

/** Network-first with cache fallback: for the HTML shell, so updates are picked up when online. */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  // Face detection model, MediaPipe wasm runtime, self-hosted Twemoji SVGs,
  // and Next.js hashed static assets: cache-first
  if (
    url.pathname.startsWith('/models/') ||
    url.pathname.startsWith('/mediapipe/') ||
    url.pathname.startsWith('/emoji/') ||
    url.pathname.startsWith('/_next/static/')
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Everything else same-origin (navigations, manifest, public images, any
  // future route): network-first with cache fallback. This is what actually
  // serves the precached app shell offline — without a respondWith here,
  // precached entries like /site.webmanifest would sit unused in the cache
  // while the browser's default fetch fails.
  event.respondWith(networkFirst(request));
});
