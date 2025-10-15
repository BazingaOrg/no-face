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
