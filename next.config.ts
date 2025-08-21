import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    // PPR only available in canary, removed for stable builds
    // ppr: true,
    // clientSegmentCache: true,
    // nodeMiddleware: true
  },
  async headers() {
    // Pull envs to build host allowlists
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseHost = SUPABASE_URL.replace(/^https?:\/\//, "");
    // If you use Sentry or Stripe now/soon, keep these:
    const sentryIngest = "o*.ingest.sentry.io";
    const vercelInsights = "cdn.vercel-insights.com";
    const stripeJs = "js.stripe.com";
    const stripeApi = "api.stripe.com";
    const stripeHooks = "hooks.stripe.com";

    const csp = [
      // Baseline
      "default-src 'self';",
      // Next needs inline styles (emotion/tailwind) & Google Fonts if used
      "style-src 'self' 'unsafe-inline' https:;",
      "font-src 'self' data: https: fonts.gstatic.com;",
      "img-src 'self' data: blob: https:;",
      // Scripts: Next chunks, Vercel analytics, (optional) Sentry CDN, Stripe
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: https: " +
        `${vercelInsights} ${stripeJs};`,
      // XHR/WebSocket destinations: Supabase, Sentry ingest, Stripe, Vercel, your APIs
      "connect-src 'self' https: wss: " +
        `${supabaseHost ? `https://${supabaseHost} wss://${supabaseHost}` : ""} ` +
        `${sentryIngest} ${stripeApi} ${vercelInsights};`,
      // Frames: allow Stripe checkout if embedded
      `frame-src 'self' https://${stripeJs} https://${stripeHooks};`,
      // Lock down the rest
      "object-src 'none';",
      "base-uri 'self';",
      "form-action 'self' https://checkout.stripe.com;",
      // Optional: stop clickjacking (can keep DENY; Stripe redirects are top-level)
      "frame-ancestors 'none';",
    ].join(" ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
