import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@amplyra/shared'],
  async rewrites() {
    const explicitTarget = process.env.API_INTERNAL_URL?.trim();
    const apiTarget =
      explicitTarget || (!process.env.VERCEL ? 'http://127.0.0.1:4000' : '');
    if (!apiTarget) {
      return [];
    }
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiTarget.replace(/\/$/, '')}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
