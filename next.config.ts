import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Partial prerendering: static shells, dynamic holes inside <Suspense>.
  cacheComponents: true,
  partialPrefetching: true,
  typedRoutes: false,
  // Content files are read at build/request time from /content.
  outputFileTracingIncludes: { "/**": ["./content/**/*"] },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
