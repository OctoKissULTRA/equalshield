import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    // PPR only available in canary, removed for stable builds
    // ppr: true,
    // clientSegmentCache: true,
    // nodeMiddleware: true
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Relaxed CSP for initial deployment; tighten later
          { key: "Content-Security-Policy", value: [
              "default-src 'self';",
              "img-src 'self' data: https:;",
              "font-src 'self' data: https:;",
              "style-src 'self' 'unsafe-inline' https:;",
              "script-src 'self' 'unsafe-eval' https:;",
              "connect-src 'self' https:;",
              "frame-ancestors 'none';",
            ].join(" ")
          },
        ],
      },
    ];
  },
};

export default nextConfig;
