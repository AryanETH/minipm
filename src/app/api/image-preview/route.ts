import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { renderTemplate, IMAGE_FORMATS } from '@/lib/images/templates'
import type { TemplateKey } from '@/lib/images/templates'

const schema = z.object({
  templateId: z.string(),
  format: z.string(),
  headline: z.string().optional().default(''),
  subheadline: z.string().optional().default(''),
  author: z.string().optional().default('Creator'),
  handle: z.string().optional().default('@creator'),
  category: z.string().optional().default('AI'),
  footer: z.string().optional().default(''),
  avatarUrl: z.string().optional().default(''),
  verified: z.boolean().optional().default(true),
  postBody: z.string().optional().default(''),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { templateId, format, ...vars } = parsed.data
  const imageFormat = IMAGE_FORMATS[format]
  if (!imageFormat)
    return NextResponse.json({ error: 'Unknown format' }, { status: 400 })

  try {
    const html = renderTemplate(templateId as TemplateKey, vars, imageFormat)
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Template error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const templateId = searchParams.get('templateId') || 'minimal-dark'
  const format = searchParams.get('format') || 'SQUARE'
  const headline = searchParams.get('headline') || ''
  const subheadline = searchParams.get('subheadline') || ''
  const author = searchParams.get('author') || 'Creator'
  const handle = searchParams.get('handle') || '@creator'
  const category = searchParams.get('category') || 'AI'
  const avatarUrl = searchParams.get('avatarUrl') || ''
  const verified = searchParams.get('verified') !== 'false'
  const postBody = searchParams.get('postBody') || headline
  const advertMode = searchParams.get('advertMode') === 'true'
  const advertLogoUrl = searchParams.get('advertLogoUrl') || ''
  const advertLogoText = searchParams.get('advertLogoText') || ''
  const advertTagline = searchParams.get('advertTagline') || ''
  const advertBgColor = searchParams.get('advertBgColor') || '#6366f1'
  // Yourstory params
  const bgImageUrl    = searchParams.get('bgImageUrl') || ''
  const accentColor   = searchParams.get('accentColor') || '#22c55e'
  const brandName     = searchParams.get('brandName') || 'BRAND'
  const categoryLabel = searchParams.get('categoryLabel') || 'NEWS'

  const imageFormat = IMAGE_FORMATS[format]
  if (!imageFormat) return new NextResponse('Unknown format', { status: 400 })

  const html = renderTemplate(templateId as TemplateKey, {
    headline, subheadline, author, handle, category, avatarUrl, verified, postBody,
    advertMode, advertLogoUrl, advertLogoText, advertTagline, advertBgColor,
    bgImageUrl, accentColor, brandName, categoryLabel,
  }, imageFormat)

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
