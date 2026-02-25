import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async rewrites() {
    return [
      {
        // Proxy API requests to Laravel's typical port if running via artisan setup
        // Note: Change 8000 to match backend port, previously it said 8001
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8000/api/:path*',
      }
    ];
  },
};

export default nextConfig;
