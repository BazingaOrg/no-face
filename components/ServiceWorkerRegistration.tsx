'use client';

import { useEffect } from 'react';
import { getTwemojiUrl } from '@/lib/twemoji';
import { CURATED_EMOJI_POOL } from '@/lib/emojiSearch';

/**
 * Warms the SW's runtime Twemoji cache with the curated/popular emoji set,
 * so the most common picks render offline without waiting for a user to
 * have clicked each one first. Runs at idle priority and fails silently —
 * this is a nice-to-have, not a correctness requirement. Relies on the SW's
 * existing cache-first handler for /emoji/ (public/sw.js); this just
 * triggers the fetches.
 */
function prefetchPopularEmojis() {
  const run = () => {
    CURATED_EMOJI_POOL.forEach((emoji) => {
      fetch(getTwemojiUrl(emoji)).catch(() => {});
    });
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(run);
  } else {
    setTimeout(run, 2000);
  }
}

/**
 * Registers the offline service worker in production.
 *
 * Skipped in development: caching /_next/static during hot reload would
 * serve stale bundles and make dev builds appear broken. If a production
 * build was previously served from this same origin (e.g. localhost:3000),
 * its service worker persists across sessions regardless of which server
 * is currently running — so dev mode actively unregisters it instead of
 * just skipping a new registration.
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      });
      return;
    }

    navigator.serviceWorker
      .register('/sw.js')
      .then(() => prefetchPopularEmojis())
      .catch((error) => {
        console.warn('Service worker registration failed:', error);
      });
  }, []);

  return null;
}
