import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async rewrites() {
    return [
      {
        // Proxy API requests to Laravel's typical port if running via artisan setup
        // Note: Restored to 8001 as that's what production expects
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8001/api/:path*',
      }
    ];
  },
};

export default nextConfig;
