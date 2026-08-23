import { NextResponse } from 'next/server'
import { TEMPLATE_METADATA, IMAGE_FORMATS } from '@/lib/images/templates'

export async function GET() {
  return NextResponse.json({
    templates: TEMPLATE_METADATA,
    formats: Object.entries(IMAGE_FORMATS).map(([key, val]) => ({
      id: key,
      ...val,
    })),
  })
}
