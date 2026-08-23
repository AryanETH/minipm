import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAIProvider } from '@/lib/ai'
import { getAllSettings } from '@/lib/settings'
import { computeSimilarity } from '@/lib/filter'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const status = searchParams.get('status') || 'PENDING'
  const minScore = parseFloat(searchParams.get('minScore') || '0')

  const where = {
    ...(status !== 'all' ? { status } : {}),
    ...(minScore > 0 ? { overallScore: { gte: minScore } } : {}),
  }

  const [total, ideas] = await Promise.all([
    prisma.idea.count({ where }),
    prisma.idea.findMany({
      where,
      orderBy: { overallScore: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        comment: { include: { source: true } },
        drafts: { take: 1 },
      },
    }),
  ])

  return NextResponse.json({ ideas, total, page, limit })
}

// Process unanalyzed comments — streams progress via Server-Sent Events
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    batchSize?: number
    stream?: boolean
  }
  const batchSize = Math.min(body.batchSize ?? 10, 50)
  const useStream = body.stream !== false

  const settings = await getAllSettings()

  // Resolve the actual model — auto-detect if DB has wrong name
  let model = settings.ollamaModel || process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b'
  const ollamaUrl = settings.ollamaUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434'

  // Check available models and auto-correct if needed
  try {
    const tagsRes = await fetch(`${ollamaUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    })
    if (tagsRes.ok) {
      const tags = await tagsRes.json() as { models?: Array<{ name: string }> }
      const available = tags.models?.map((m) => m.name) ?? []
      if (available.length > 0 && !available.includes(model)) {
        // Configured model not found — use first available
        model = available[0]
        // Save the correction so it doesn't keep failing
        await prisma.settings.upsert({
          where: { key: 'ollamaModel' },
          create: { key: 'ollamaModel', value: model },
          update: { value: model },
        })
      }
    }
  } catch {
    // Can't reach Ollama at all
    return NextResponse.json(
      { error: `Cannot reach Ollama at ${ollamaUrl}. Run: ollama serve` },
      { status: 503 }
    )
  }

  const ai = getAIProvider({
    baseUrl: ollamaUrl,
    model,
    temperature: settings.ollamaTemperature ?? 0.3,
  })

  const healthy = await ai.checkHealth()
  if (!healthy) {
    return NextResponse.json(
      { error: `Ollama is not responding at ${ollamaUrl}. Run: ollama serve` },
      { status: 503 }
    )
  }

  const comments = await prisma.comment.findMany({
    where: { filtered: false, processed: false },
    orderBy: [{ likeCount: 'desc' }],
    take: batchSize,
  })

  if (comments.length === 0) {
    const totalComments = await prisma.comment.count()
    const alreadyProcessed = await prisma.comment.count({ where: { processed: true } })
    const filtered = await prisma.comment.count({ where: { filtered: true } })

    // Return SSE even for the empty case so client never has to check content-type
    if (useStream) {
      const encoder = new TextEncoder()
      const emptyStream = new ReadableStream({
        start(controller) {
          const payload = JSON.stringify({
            type: 'done',
            processed: 0,
            qualified: 0,
            errors: [],
            model,
            debug: { totalComments, alreadyProcessed, filtered, available: 0 },
          })
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`))
          controller.close()
        },
      })
      return new NextResponse(emptyStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    return NextResponse.json({
      processed: 0,
      qualified: 0,
      message: 'No unprocessed comments',
      debug: { totalComments, alreadyProcessed, filtered, available: 0 },
    })
  }

  // Streaming SSE response for real-time progress
  if (useStream) {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        function send(data: object) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        }

        let processed = 0
        let qualified = 0
        const errors: string[] = []
        // Track all scored results so we can fall back if nothing hits threshold
        const allScored: Array<{ commentId: string; score: number }> = []

        send({ type: 'start', total: comments.length, model })

        for (const comment of comments) {
          try {
            send({ type: 'progress', current: processed, total: comments.length, text: comment.text.slice(0, 60) })
            const result = await ai.analyzeComment(comment.text, comment.videoTitle)

            await prisma.comment.update({
              where: { id: comment.id },
              data: { processed: true },
            })

            const meetsThreshold = result.overall_score >= settings.minContentScore && result.should_use

            // Always store ideas with score >= 4 so we have material to work with
            if (result.overall_score >= 4) {
              allScored.push({ commentId: comment.id, score: result.overall_score })
              await prisma.idea.upsert({
                where: { commentId: comment.id },
                create: {
                  commentId: comment.id,
                  insightScore: result.insight_score,
                  noveltyScore: result.novelty_score,
                  relatabilityScore: result.relatability_score,
                  controversyScore: result.controversy_score,
                  viralScore: result.viral_score,
                  originalityScore: result.originality_score,
                  overallScore: result.overall_score,
                  category: result.category,
                  coreIdea: result.core_idea,
                  reason: result.reason,
                  shouldUse: meetsThreshold,
                  // Use PENDING for high scorers, REJECTED for low but still stored
                  status: meetsThreshold ? 'PENDING' : 'REJECTED',
                },
                update: {},
              })
              if (meetsThreshold) qualified++
            }
            processed++
            send({ type: 'item', processed, qualified, score: result.overall_score, category: result.category })
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error'
            errors.push(msg)
            send({ type: 'error', message: msg, commentId: comment.id })
            await prisma.comment.update({
              where: { id: comment.id },
              data: { processed: true },
            })
          }
        }

        // If nothing hit the threshold, promote the top 5 best-scoring ideas anyway
        // and auto-generate drafts so the user has ready-to-use content
        if (qualified === 0 && allScored.length > 0) {
          const top5 = allScored.sort((a, b) => b.score - a.score).slice(0, 5)
          for (const { commentId } of top5) {
            await prisma.idea.updateMany({
              where: { commentId, status: 'REJECTED' },
              data: { status: 'PENDING', shouldUse: true },
            })
          }
          qualified = top5.length
          send({
            type: 'promoted',
            count: top5.length,
            message: `No comments met the ${settings.minContentScore} threshold — promoted top ${top5.length} by score instead`,
          })

          // Auto-generate drafts for the promoted ideas
          const promotedIdeas = await prisma.idea.findMany({
            where: { commentId: { in: top5.map((t) => t.commentId) }, status: 'PENDING' },
            include: { comment: true, drafts: { take: 1 } },
          })
          const genAi = ai
          const profile = {
            name: settings.authorName,
            handle: settings.authorHandle,
            topics: settings.topics.split(',').map((s: string) => s.trim()),
            writingStyle: settings.writingStyle.split(',').map((s: string) => s.trim()),
            avoidTopics: settings.avoidTopics.split(',').map((s: string) => s.trim()),
            blockedWords: settings.blockedWords.split(',').map((s: string) => s.trim()).filter(Boolean),
          }
          let draftsGenerated = 0
          for (const idea of promotedIdeas) {
            // Skip if a draft already exists for this idea
            if (idea.drafts.length > 0) continue
            try {
              const generated = await genAi.generateContent(idea.coreIdea, profile)
              const similarity = computeSimilarity(
                idea.comment.text,
                generated.xContent + ' ' + generated.linkedinContent
              )
              let finalContent = generated
              if (similarity > 0.7) {
                finalContent = await genAi.generateContent(
                  `Reframe this idea from a completely different angle: ${idea.coreIdea}`,
                  profile
                )
              }
              await prisma.draft.create({
                data: {
                  ideaId: idea.id,
                  xContent: finalContent.xContent,
                  linkedinContent: finalContent.linkedinContent,
                  imageHeadline: finalContent.imageHeadline,
                  imageSubheadline: finalContent.imageSubheadline,
                  imageFooter: finalContent.imageFooter,
                  similarityScore: similarity,
                },
              })
              await prisma.idea.update({ where: { id: idea.id }, data: { status: 'DRAFTED' } })
              draftsGenerated++
            } catch {
              // Non-fatal — idea is still promoted even if draft generation fails
            }
          }
          if (draftsGenerated > 0) {
            send({
              type: 'drafted',
              count: draftsGenerated,
              message: `Auto-generated ${draftsGenerated} draft${draftsGenerated > 1 ? 's' : ''} from promoted ideas`,
            })
          }
        }

        send({ type: 'done', processed, qualified, errors, model })
        controller.close()
      },
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  }

  // Non-streaming fallback
  let processed = 0
  let qualified = 0
  const errors: string[] = []

  for (const comment of comments) {
    try {
      const result = await ai.analyzeComment(comment.text, comment.videoTitle)
      await prisma.comment.update({ where: { id: comment.id }, data: { processed: true } })
      const meetsThreshold = result.overall_score >= settings.minContentScore && result.should_use
      if (meetsThreshold || result.overall_score >= 5) {
        await prisma.idea.upsert({
          where: { commentId: comment.id },
          create: {
            commentId: comment.id,
            insightScore: result.insight_score,
            noveltyScore: result.novelty_score,
            relatabilityScore: result.relatability_score,
            controversyScore: result.controversy_score,
            viralScore: result.viral_score,
            originalityScore: result.originality_score,
            overallScore: result.overall_score,
            category: result.category,
            coreIdea: result.core_idea,
            reason: result.reason,
            shouldUse: meetsThreshold,
            status: meetsThreshold ? 'PENDING' : 'REJECTED',
          },
          update: {},
        })
        if (meetsThreshold) qualified++
      }
      processed++
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      errors.push(msg)
      await prisma.comment.update({ where: { id: comment.id }, data: { processed: true } })
    }
  }

  return NextResponse.json({ processed, qualified, errors, model })
}
