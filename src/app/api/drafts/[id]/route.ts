export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'

const updateSchema = z.object({
  xContent: z.string().optional(),
  linkedinContent: z.string().optional(),
  imageHeadline: z.string().optional(),
  imageSubheadline: z.string().optional(),
  imageFooter: z.string().optional(),
  status: z.enum(['DRAFT', 'APPROVED', 'REJECTED']).optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const draft = await prisma.draft.findUnique({
    where: { id },
    include: {
      idea: {
        include: { comment: { include: { source: true } } },
      },
      scheduledPosts: true,
      generatedImages: { include: { template: true } },
    },
  })
  if (!draft) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(draft)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const draft = await prisma.draft.update({ where: { id }, data: parsed.data })
  return NextResponse.json(draft)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await prisma.draft.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
