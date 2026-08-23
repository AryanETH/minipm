import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  typescript: {
    // Prisma client is generated at build time via `prisma generate && next build`
    // Type errors are caught locally with `tsc --noEmit`
    ignoreBuildErrors: true,
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
