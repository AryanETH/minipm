import { prisma } from '@/lib/db'
import {
  MessageSquare,
  Cpu,
  Lightbulb,
  FileText,
  Clock,
  CheckCircle2,
  TrendingUp,
  Share2,
  Briefcase,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatNumber, scoreColor } from '@/lib/utils'
import { format } from 'date-fns'
import Link from 'next/link'

async function getStats() {
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

  return {
    commentsToday,
    commentsAnalyzed,
    highQualityIdeas,
    draftsGenerated,
    scheduledPosts,
    postsPublished,
    avgScore: avgScoreResult._avg.overallScore ?? 0,
    topIdeas,
    todayQueue,
  }
}

export async function DashboardContent() {
  const stats = await getStats()

  const statCards = [
    { label: 'Comments Today', value: formatNumber(stats.commentsToday), icon: MessageSquare, color: 'text-sky-400' },
    { label: 'Analyzed', value: formatNumber(stats.commentsAnalyzed), icon: Cpu, color: 'text-purple-400' },
    { label: 'Quality Ideas', value: formatNumber(stats.highQualityIdeas), icon: Lightbulb, color: 'text-yellow-400' },
    { label: 'Drafts', value: formatNumber(stats.draftsGenerated), icon: FileText, color: 'text-blue-400' },
    { label: 'Scheduled', value: formatNumber(stats.scheduledPosts), icon: Clock, color: 'text-orange-400' },
    { label: 'Published', value: formatNumber(stats.postsPublished), icon: CheckCircle2, color: 'text-emerald-400' },
    { label: 'Avg AI Score', value: stats.avgScore.toFixed(1), icon: TrendingUp, color: 'text-indigo-400' },
  ]

  return (
    <div className="px-8 py-6 space-y-6 animate-fade-in">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="hover:border-zinc-700 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className="text-2xl font-semibold text-zinc-100 tabular-nums">{value}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Queue */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Today&apos;s Queue</span>
              <Link href="/queue" className="text-xs text-indigo-400 hover:text-indigo-300">
                View all →
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.todayQueue.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">No posts scheduled for today</p>
                <Link href="/queue" className="text-xs text-indigo-400 hover:underline mt-1 block">
                  Schedule something →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {stats.todayQueue.map((post) => (
                  <div
                    key={post.id}
                    className="flex items-center gap-3 p-3 rounded-md bg-zinc-800/40 hover:bg-zinc-800/60 transition-colors"
                  >
                    <div className="text-xs text-zinc-400 font-mono w-14 shrink-0">
                      {post.scheduledAt ? format(new Date(post.scheduledAt), 'HH:mm') : '--:--'}
                    </div>
                    {post.platform === 'X' ? (
                      <Share2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    ) : (
                      <Briefcase className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    )}
                    <p className="text-sm text-zinc-300 truncate flex-1">{post.content.slice(0, 60)}...</p>
                    <Badge variant={post.status === 'SCHEDULED' ? 'yellow' : 'indigo'} className="shrink-0">
                      {post.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Ideas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Top Ideas</span>
              <Link href="/inbox" className="text-xs text-indigo-400 hover:text-indigo-300">
                View inbox →
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.topIdeas.length === 0 ? (
              <div className="text-center py-8">
                <Lightbulb className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">No high-quality ideas yet</p>
                <Link href="/sources" className="text-xs text-indigo-400 hover:underline mt-1 block">
                  Add sources and scan →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {stats.topIdeas.map((idea) => (
                  <Link
                    key={idea.id}
                    href={`/inbox?idea=${idea.id}`}
                    className="block p-3 rounded-md bg-zinc-800/40 hover:bg-zinc-800/60 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-zinc-300 line-clamp-2 group-hover:text-zinc-100">
                        {idea.coreIdea}
                      </p>
                      <span className={`text-sm font-semibold shrink-0 tabular-nums ${scoreColor(idea.overallScore)}`}>
                        {idea.overallScore.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="default" className="text-[10px]">{idea.category}</Badge>
                      {idea.comment.source && (
                        <span className="text-[11px] text-zinc-600">{idea.comment.source.name}</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
