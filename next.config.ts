import type { NextConfig } from "next";

// All processing is client-side; the only external origin is jsDelivr
// (Twemoji SVGs, emoji-picker-react assets, CDN model fallback).
// script-src needs 'unsafe-eval' for TensorFlow.js (face-api) and Next dev,
// and 'unsafe-inline' for Next's inline runtime scripts.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
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
  webpack: (config, { isServer }) => {
    // Fix for @vladmandic/face-api - only load in browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
      
      // Suppress critical dependency warnings for face-api
      config.module = config.module || {};
      config.module.unknownContextCritical = false;
      config.module.exprContextCritical = false;
      config.module.wrappedContextCritical = false;
      
      // Add specific rule to ignore warnings from @vladmandic/face-api
      config.ignoreWarnings = config.ignoreWarnings || [];
      config.ignoreWarnings.push({
        module: /node_modules\/@vladmandic\/face-api/,
        message: /Critical dependency/,
      });
    } else {
      // Exclude @vladmandic/face-api from server-side bundle
      config.externals = config.externals || [];
      config.externals.push({
        '@vladmandic/face-api': 'commonjs @vladmandic/face-api',
      });
    }
    return config;
  },
};

export default nextConfig;
