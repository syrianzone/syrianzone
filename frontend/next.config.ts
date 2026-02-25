import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async rewrites() {
    // In local development we want Next.js to proxy to artisan serve
    // In production, Nginx directly takes over the /api location block
    // before it reaches Node.js, so this rewrite mostly matters for local.
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd) {
      return [];
    }

    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8000/api/:path*',
      }
    ];
  },
};

export default nextConfig;
