import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  getRecentVideos,
  getVideoComments,
  getVideoById,
  searchVideosByKeyword,
  extractVideoId,
} from '@/lib/youtube/client'
import { filterComment } from '@/lib/filter'
import { getAllSettings } from '@/lib/settings'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const source = await prisma.source.findUnique({ where: { id } })
  if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 })
  if (!source.enabled)
    return NextResponse.json({ error: 'Source is disabled' }, { status: 400 })

  const settings = await getAllSettings()

  // API key: prefer DB setting, fall back to env var
  const apiKey = settings.youtubeApiKey || process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'YouTube API key is not configured. Add it in Settings → YouTube.' },
      { status: 400 }
    )
  }

  // Inject key into env so the YouTube client picks it up for this request
  process.env.YOUTUBE_API_KEY = apiKey
  let videosCollected = 0
  let commentsCollected = 0
  let commentsFiltered = 0

  try {
    let videos: Awaited<ReturnType<typeof getRecentVideos>> = []

    if (source.type === 'CHANNEL') {
      videos = await getRecentVideos(source.identifier, settings.videosPerSource)
    } else if (source.type === 'VIDEO') {
      const vid = await extractVideoId(source.identifier)
      if (vid) {
        const v = await getVideoById(vid)
        if (v) videos = [v]
      }
    } else if (source.type === 'KEYWORD') {
      videos = await searchVideosByKeyword(source.identifier, settings.videosPerSource)
    }

    for (const v of videos) {
      // Upsert video
      await prisma.video.upsert({
        where: { youtubeId: v.id },
        create: {
          youtubeId: v.id,
          title: v.title,
          channelId: v.channelId,
          channelTitle: v.channelTitle,
          publishedAt: new Date(v.publishedAt),
          url: v.url,
          thumbnailUrl: v.thumbnailUrl,
          viewCount: v.viewCount,
          likeCount: v.likeCount,
          commentCount: v.commentCount,
          sourceId: id,
        },
        update: {
          viewCount: v.viewCount,
          likeCount: v.likeCount,
          commentCount: v.commentCount,
        },
      })
      videosCollected++

      const comments = await getVideoComments(
        v.id,
        v.title,
        settings.commentsPerVideo
      )

      for (const c of comments) {
        // Skip duplicates
        const existing = await prisma.comment.findUnique({
          where: { youtubeCommentId: c.id },
        })
        if (existing) continue

        if (c.likeCount < source.minimumLikes) continue

        const filterResult = filterComment(c.text, {
          minLength: settings.minCommentLength,
          minLikes: settings.minCommentLikes,
          blockedPhrases: settings.blockedPhrases.split(',').map((s) => s.trim()),
          blockedPatterns: [
            /^[\p{Emoji}\s]+$/u,
            /^https?:\/\//i,
            /(.)\1{4,}/,
            /^[^a-zA-Z]*$/,
          ],
        })

        await prisma.comment.create({
          data: {
            youtubeCommentId: c.id,
            videoId: c.videoId,
            videoTitle: c.videoTitle,
            author: c.author,
            text: c.text,
            likeCount: c.likeCount,
            replyCount: c.replyCount,
            publishedAt: new Date(c.publishedAt),
            url: c.url,
            sourceId: id,
            filtered: !filterResult.passed,
            filterReason: filterResult.reason,
          },
        })
        commentsCollected++
        if (!filterResult.passed) commentsFiltered++
      }
    }

    await prisma.source.update({
      where: { id },
      data: { lastCheckedAt: new Date() },
    })

    return NextResponse.json({
      ok: true,
      videosCollected,
      commentsCollected,
      commentsFiltered,
      commentsQueued: commentsCollected - commentsFiltered,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Scan failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
