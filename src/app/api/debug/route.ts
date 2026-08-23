export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAllSettings } from '@/lib/settings'
import { getAIProvider } from '@/lib/ai'

export async function GET() {
  const settings = await getAllSettings()

  const [
    totalComments,
    unprocessed,
    filtered,
    processed,
    ideas,
    drafts,
    sampleFiltered,
    sampleUnprocessed,
  ] = await Promise.all([
    prisma.comment.count(),
    prisma.comment.count({ where: { filtered: false, processed: false } }),
    prisma.comment.count({ where: { filtered: true } }),
    prisma.comment.count({ where: { processed: true } }),
    prisma.idea.count(),
    prisma.draft.count(),
    prisma.comment.findMany({
      where: { filtered: true },
      take: 5,
      select: { text: true, filterReason: true },
    }),
    prisma.comment.findMany({
      where: { filtered: false, processed: false },
      take: 3,
      select: { text: true, likeCount: true },
    }),
  ])

  const ai = getAIProvider({
    baseUrl: settings.ollamaUrl,
    model: settings.ollamaModel,
  })
  const ollamaHealthy = await ai.checkHealth()

  return NextResponse.json({
    comments: { totalComments, unprocessed, filtered, processed },
    ideas,
    drafts,
    ollamaHealthy,
    ollamaUrl: settings.ollamaUrl,
    ollamaModel: settings.ollamaModel,
    minContentScore: settings.minContentScore,
    sampleFiltered,
    sampleUnprocessed,
  })
}
