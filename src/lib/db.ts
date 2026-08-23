import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import path from 'path'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const dbUrl = process.env.DATABASE_URL || 'file:./content.db'
  const dbPath = dbUrl.replace(/^file:/, '')
  const resolvedPath = path.isAbsolute(dbPath)
    ? dbPath
    : path.join(process.cwd(), dbPath)

  const adapter = new PrismaBetterSqlite3({ url: resolvedPath /* turbopackIgnore: true */ })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
