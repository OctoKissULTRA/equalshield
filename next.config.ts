import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    // PPR only available in canary, removed for stable builds
    // ppr: true,
    // clientSegmentCache: true,
    // nodeMiddleware: true
  }
};

export default nextConfig;
