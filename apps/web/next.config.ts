import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@amplyra/shared'],
  async rewrites() {
    const apiTarget = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiTarget}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
