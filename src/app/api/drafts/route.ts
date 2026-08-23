import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAIProvider } from '@/lib/ai'
import { getAllSettings } from '@/lib/settings'
import { computeSimilarity } from '@/lib/filter'
import type { AuthorProfile } from '@/lib/ai/types'

const createDraftSchema = z.object({
  ideaId: z.string().min(1),
})

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const status = searchParams.get('status')

  const where = status ? { status } : {}
  const [total, drafts] = await Promise.all([
    prisma.draft.count({ where }),
    prisma.draft.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        idea: {
          include: { comment: { include: { source: true } } },
        },
        scheduledPosts: true,
        generatedImages: { take: 1 },
      },
    }),
  ])

  return NextResponse.json({ drafts, total, page, limit })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = createDraftSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const idea = await prisma.idea.findUnique({
    where: { id: parsed.data.ideaId },
    include: { comment: true },
  })
  if (!idea) return NextResponse.json({ error: 'Idea not found' }, { status: 404 })

  const settings = await getAllSettings()
  const ai = getAIProvider()

  const healthy = await ai.checkHealth()
  if (!healthy) {
    return NextResponse.json(
      { error: 'Ollama is not running. Start it with: ollama serve' },
      { status: 503 }
    )
  }

  const profile: AuthorProfile = {
    name: settings.authorName,
    handle: settings.authorHandle,
    topics: settings.topics.split(',').map((s) => s.trim()),
    writingStyle: settings.writingStyle.split(',').map((s) => s.trim()),
    avoidTopics: settings.avoidTopics.split(',').map((s) => s.trim()),
    blockedWords: settings.blockedWords.split(',').map((s) => s.trim()).filter(Boolean),
  }

  let generated: Awaited<ReturnType<typeof ai.generateContent>>
  try {
    generated = await ai.generateContent(idea.coreIdea, profile)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Content generation failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  // Compute similarity between source comment and generated content
  const similarity = computeSimilarity(
    idea.comment.text,
    generated.xContent + ' ' + generated.linkedinContent
  )

  // If too similar (>0.7), try once more
  let finalContent = generated
  if (similarity > 0.7) {
    try {
      finalContent = await ai.generateContent(
        `Reframe this idea from a completely different angle: ${idea.coreIdea}`,
        profile
      )
    } catch {
      // Non-fatal — use original generation if retry fails
    }
  }

  const draft = await prisma.draft.create({
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

  await prisma.idea.update({
    where: { id: idea.id },
    data: { status: 'DRAFTED' },
  })

  return NextResponse.json(draft, { status: 201 })
}
