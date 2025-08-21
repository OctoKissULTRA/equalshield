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
      "default-src 'self' data: blob: https:;", // allow self + remote assets as a safety net

      // Styles & fonts (Tailwind + Next + Google Fonts + blob CSS)
      "style-src 'self' 'unsafe-inline' blob: https: https://fonts.googleapis.com;",
      "font-src 'self' data: https: https://fonts.gstatic.com;",

      // Images/icons
      "img-src 'self' data: blob: https:;",

      // Scripts (Next chunks + hydration + analytics + Stripe)
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https: " +
        `${vercelInsights} ${stripeJs};`,

      // XHR/WebSocket (Supabase, Sentry, Stripe, Vercel)
      "connect-src 'self' https: wss: " +
        `${supabaseHost ? `https://${supabaseHost} wss://${supabaseHost}` : ""} ` +
        `${sentryIngest} ${stripeApi} ${vercelInsights};`,

      // Workers (Next can use blob workers)
      "worker-src 'self' blob:;",

      // Manifests/prefetch
      "manifest-src 'self';",
      "prefetch-src 'self' https:;",

      // Frames for Stripe
      `frame-src 'self' https://${stripeJs} https://${stripeHooks};`,

      // Lock down the rest
      "object-src 'none';",
      "base-uri 'self';",
      "form-action 'self' https://checkout.stripe.com;",
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
