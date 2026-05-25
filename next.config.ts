import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: 'http://localhost:3001/api/:path*' },
      { source: '/uploads/:path*', destination: 'http://localhost:3001/uploads/:path*' },
    ]
  },
};

export default nextConfig;
