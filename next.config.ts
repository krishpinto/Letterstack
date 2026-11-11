import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // /landing was an older copy of the marketing page. It is gone; the
      // live landing page is "/".
      { source: "/landing", destination: "/", permanent: true },
      { source: "/landing/:path*", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;
