export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { filterComment, cleanCommentText } from '@/lib/filter'
import { getAllSettings } from '@/lib/settings'

// Re-runs the filter on all collected comments and resets processed/filtered flags
// so they can be re-analyzed by Ollama
export async function POST() {
  const settings = await getAllSettings()

  const blockedPhrases = settings.blockedPhrases
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const blockedPatterns = [
    /^[\p{Emoji}\s]+$/u,
    /^https?:\/\/\S+\s*$/i,
    /(.)\1{5,}/,
    /^[^a-zA-Z]{0,5}$/,
  ]

  const allComments = await prisma.comment.findMany({
    select: { id: true, text: true, likeCount: true },
  })

  let resetCount = 0
  let stillFiltered = 0

  for (const c of allComments) {
    const result = filterComment(c.text, {
      minLength: settings.minCommentLength,
      minLikes: settings.minCommentLikes,
      blockedPhrases,
      blockedPatterns,
    })

    if (result.passed) {
      // Reset so Ollama can process it
      await prisma.comment.update({
        where: { id: c.id },
        data: { filtered: false, filterReason: null, processed: false },
      })
      resetCount++
    } else {
      // Keep filtered but update the reason
      await prisma.comment.update({
        where: { id: c.id },
        data: { filtered: true, filterReason: result.reason, processed: false },
      })
      stillFiltered++
    }
  }

  return NextResponse.json({
    total: allComments.length,
    resetCount,
    stillFiltered,
    message: `${resetCount} comments are now ready for AI analysis`,
  })
}
