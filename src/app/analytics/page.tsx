import { PageHeader } from '@/components/layout/page-header'
import { prisma } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart2, TrendingUp, Zap, MessageSquare } from 'lucide-react'
import { formatNumber } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  const [
    totalComments,
    filteredComments,
    processedComments,
    totalIdeas,
    totalDrafts,
    totalScheduled,
    totalPosted,
    topCategories,
    avgScore,
    recentActivity,
  ] = await Promise.all([
    prisma.comment.count(),
    prisma.comment.count({ where: { filtered: true } }),
    prisma.comment.count({ where: { processed: true } }),
    prisma.idea.count(),
    prisma.draft.count(),
    prisma.scheduledPost.count({ where: { status: { in: ['SCHEDULED', 'APPROVED'] } } }),
    prisma.publishedPost.count(),
    prisma.idea.groupBy({
      by: ['category'],
      _count: { _all: true },
      _avg: { overallScore: true },
      orderBy: { _count: { category: 'desc' } },
      take: 8,
    }),
    prisma.idea.aggregate({ _avg: { overallScore: true } }),
    prisma.comment.findMany({
      orderBy: { discoveredAt: 'desc' },
      take: 7,
      select: { discoveredAt: true },
    }),
  ])

  const pipeline = [
    { label: 'Discovered', value: totalComments, color: 'text-sky-400' },
    { label: 'Passed Filter', value: totalComments - filteredComments, color: 'text-blue-400' },
    { label: 'AI Analyzed', value: processedComments, color: 'text-purple-400' },
    { label: 'Quality Ideas', value: totalIdeas, color: 'text-yellow-400' },
    { label: 'Drafts Created', value: totalDrafts, color: 'text-orange-400' },
    { label: 'Queued', value: totalScheduled, color: 'text-indigo-400' },
    { label: 'Published', value: totalPosted, color: 'text-emerald-400' },
  ]

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Content pipeline performance"
      />
      <div className="px-8 py-6 space-y-6">
        {/* Pipeline funnel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              Content Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              {pipeline.map(({ label, value, color }, i) => {
                const pct = totalComments > 0 ? (value / totalComments) * 100 : 0
                return (
                  <div key={label} className="flex-1 text-center">
                    <div className="relative flex items-end justify-center" style={{ height: 80 }}>
                      <div
                        className={`w-full bg-zinc-800 rounded-sm transition-all`}
                        style={{ height: `${Math.max(pct, 4)}%` }}
                      >
                        <div className={`w-full h-full rounded-sm opacity-60 ${color.replace('text-', 'bg-')}`} />
                      </div>
                    </div>
                    <p className={`text-lg font-bold tabular-nums mt-1 ${color}`}>
                      {formatNumber(value)}
                    </p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">{label}</p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Categories */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                Top Categories
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topCategories.length === 0 ? (
                <p className="text-sm text-zinc-600">No data yet</p>
              ) : (
                <div className="space-y-3">
                  {topCategories.map((cat: { category: string; _count: { _all: number }; _avg: { overallScore: number | null } }) => {
                    const pct = totalIdeas > 0 ? (cat._count._all / totalIdeas) * 100 : 0
                    return (
                      <div key={cat.category}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-zinc-300">{cat.category}</span>
                          <div className="flex items-center gap-3 text-xs text-zinc-500">
                            <span>{cat._count._all} ideas</span>
                            <span className="text-indigo-400">
                              avg {(cat._avg.overallScore ?? 0).toFixed(1)}
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-purple-400" />
                Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { label: 'Filter pass rate', value: totalComments > 0 ? `${((totalComments - filteredComments) / totalComments * 100).toFixed(1)}%` : '—' },
                  { label: 'AI qualify rate', value: processedComments > 0 ? `${(totalIdeas / processedComments * 100).toFixed(1)}%` : '—' },
                  { label: 'Draft conversion', value: totalIdeas > 0 ? `${(totalDrafts / totalIdeas * 100).toFixed(1)}%` : '—' },
                  { label: 'Publish rate', value: totalDrafts > 0 ? `${(totalPosted / totalDrafts * 100).toFixed(1)}%` : '—' },
                  { label: 'Average AI score', value: (avgScore._avg.overallScore ?? 0).toFixed(2) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">{label}</span>
                    <span className="text-zinc-200 font-medium tabular-nums">{value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <p className="text-xs text-zinc-700 text-center">
          More detailed analytics (impressions, engagement rates) will be added in Phase 2.
        </p>
      </div>
    </div>
  )
}
