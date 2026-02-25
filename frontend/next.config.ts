import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async rewrites() {
    return [
      {
        // Proxy API requests to Laravel's typical port if running via artisan setup
        // Note: Switched to 8000 as per production
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8000/api/:path*',
      }
    ];
  },
};

export default nextConfig;
