import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // /landing was an older copy of the marketing page. It is gone; the
      // live landing page is "/".
      { source: "/landing", destination: "/", permanent: true },
      { source: "/landing/:path*", destination: "/", permanent: true },
      // The audience page used to answer at two URLs. /dashboard/audience is
      // the canonical one; the query string (?folder=, ?import=1, …) is
      // carried over.
      {
        source: "/dashboard/contacts",
        destination: "/dashboard/audience",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
