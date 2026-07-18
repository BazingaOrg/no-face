import type { NextConfig } from "next";

// All processing is client-side; the only external origin is jsDelivr
// (Twemoji SVGs). Face detection runs via
// @mediapipe/tasks-vision, fully self-hosted (wasm + .task model under
// public/), so script-src only needs 'wasm-unsafe-eval' for its WASM
// compilation, not the broader 'unsafe-eval'. 'unsafe-inline' remains for
// Next's inline runtime scripts. Dev-only 'unsafe-eval' is required by
// Next's react-refresh runtime; it is never emitted in production builds.
const isDev = process.env.NODE_ENV === 'development';

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://cdn.jsdelivr.net",
  "connect-src 'self' https://cdn.jsdelivr.net",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
