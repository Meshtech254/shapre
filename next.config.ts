import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
const config: NextConfig = {
  poweredByHeader: false,
  webpack(config, { dev }) {
    if (!dev) config.cache = false;
    return config;
  },
  images: {
    remotePatterns: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? [
          {
            protocol:
              new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).protocol === "http:"
                ? "http"
                : "https",
            hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,
            port: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).port,
            pathname: "/storage/v1/**",
          },
        ]
      : [],
    minimumCacheTTL: 60,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self)",
          },
        ],
      },
    ];
  },
};
export default function nextConfig(phase: string): NextConfig {
  return {
    ...config,
    distDir:
      phase === PHASE_DEVELOPMENT_SERVER
        ? process.env.INFERENCE_MODE === "local"
          ? ".next-local"
          : process.env.INFERENCE_MODE === "remote"
            ? ".next-remote"
            : ".next"
        : ".next-production",
  };
}
