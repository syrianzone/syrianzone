import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async rewrites() {
    // In production, Laravel's app.php explicitly strips the 'api' prefix 
    // from internal routes. In development, it retains it. We adjust our
    // proxy path accordingly.
    const isProd = process.env.NODE_ENV === 'production';
    const backendUrl = process.env.API_PROXY_URL || 'http://127.0.0.1:8000';
    const destinationPath = isProd ? `${backendUrl}/:path*` : `${backendUrl}/api/:path*`;

    return [
      {
        source: '/api/:path*',
        destination: destinationPath,
      }
    ];
  },
};

export default nextConfig;
