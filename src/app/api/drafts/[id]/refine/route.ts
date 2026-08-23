export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAIProvider } from '@/lib/ai'

const refineSchema = z.object({
  content: z.string().min(1),
  instruction: z.enum([
    'shorten',
    'expand',
    'make more controversial',
    'simplify',
    'create alternative hook',
    'make more conversational',
    'add more data/specificity',
  ]),
  platform: z.enum(['x', 'linkedin']),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params // consume params
  const body = await req.json()
  const parsed = refineSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const ai = getAIProvider()
  const healthy = await ai.checkHealth()
  if (!healthy) {
    return NextResponse.json(
      { error: 'Ollama is not running' },
      { status: 503 }
    )
  }

  let refined: string
  try {
    refined = await ai.refineContent(
      parsed.data.content,
      parsed.data.instruction,
      parsed.data.platform
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Content refinement failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  return NextResponse.json({ content: refined })
}
