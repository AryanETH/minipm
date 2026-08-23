import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  typescript: {
    // Prisma types are generated at build time — type errors are caught locally
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'yt3.ggpht.com' },
    ],
  },
  serverExternalPackages: ['@prisma/client', 'better-sqlite3', 'puppeteer'],
}

export default nextConfig
