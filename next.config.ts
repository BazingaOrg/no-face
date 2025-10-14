import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // Fix for @vladmandic/face-api - only load in browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
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
