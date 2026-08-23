import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const [
    commentsToday,
    commentsAnalyzed,
    highQualityIdeas,
    draftsGenerated,
    scheduledPosts,
    postsPublished,
    topIdeas,
    todayQueue,
    avgScoreResult,
  ] = await Promise.all([
    prisma.comment.count({ where: { discoveredAt: { gte: today } } }),
    prisma.comment.count({ where: { processed: true } }),
    prisma.idea.count({ where: { shouldUse: true } }),
    prisma.draft.count(),
    prisma.scheduledPost.count({ where: { status: 'SCHEDULED' } }),
    prisma.publishedPost.count(),
    prisma.idea.findMany({
      where: { status: { in: ['PENDING', 'SAVED'] } },
      orderBy: { overallScore: 'desc' },
      take: 5,
      include: { comment: { include: { source: true } } },
    }),
    prisma.scheduledPost.findMany({
      where: {
        scheduledAt: { gte: today, lt: tomorrow },
        status: { in: ['SCHEDULED', 'APPROVED'] },
      },
      orderBy: { scheduledAt: 'asc' },
      include: { draft: true },
    }),
    prisma.idea.aggregate({ _avg: { overallScore: true } }),
  ])

  return NextResponse.json({
    commentsToday,
    commentsAnalyzed,
    highQualityIdeas,
    draftsGenerated,
    scheduledPosts,
    postsPublished,
    avgScore: avgScoreResult._avg.overallScore ?? 0,
    topIdeas,
    todayQueue,
  })
}
