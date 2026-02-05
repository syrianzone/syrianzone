import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async rewrites() {
    const sites = [
      'alignment', 'compass', 'house', 'legacytierlist', 'party',
      'population', 'syid', 'syofficial', 'stats', 'sites'
    ];

    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8001/api/:path*',
      },
      ...sites.flatMap(site => [
        {
          source: `/${site}`,
          destination: `/${site}/index.html`,
        },
        {
          source: `/${site}/:path*`,
          destination: `/${site}/:path*`,
        }
      ])
    ];
  },
};

export default nextConfig;
