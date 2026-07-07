/**
 * Service worker for offline support.
 *
 * All face detection runs on models already self-hosted in /models, and all
 * image processing happens on-device — the only network dependency is the
 * initial page load and the Twemoji CDN. Caching both lets the app keep
 * working (including re-opening previously used emojis) with no connection.
 *
 * Bump CACHE_VERSION whenever precached assets change so old caches are
 * dropped on activate instead of accumulating forever.
 */
const CACHE_VERSION = 'v1';
const CACHE_NAME = `no-face-${CACHE_VERSION}`;

const MODEL_ASSETS = [
  '/models/ssd_mobilenetv1_model-weights_manifest.json',
  '/models/ssd_mobilenetv1_model.bin',
  '/models/tiny_face_detector_model-weights_manifest.json',
  '/models/tiny_face_detector_model.bin',
  '/models/face_landmark_68_model-weights_manifest.json',
  '/models/face_landmark_68_model.bin',
];

const APP_SHELL = ['/', '/site.webmanifest', '/kaonashi.jpg', ...MODEL_ASSETS];

const TWEMOJI_ORIGIN = 'https://cdn.jsdelivr.net';

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

  // Twemoji assets: cache-first so previously used emojis render offline
  if (url.origin === TWEMOJI_ORIGIN) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Face detection models and Next.js hashed static assets: cache-first
  if (url.pathname.startsWith('/models/') || url.pathname.startsWith('/_next/static/')) {
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
