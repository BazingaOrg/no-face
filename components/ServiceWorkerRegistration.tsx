'use client';

import { useEffect } from 'react';

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

    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Service worker registration failed:', error);
    });
  }, []);

  return null;
}
