import { NextResponse } from 'next/server'
import { getAIProvider } from '@/lib/ai'
import { getSetting } from '@/lib/settings'

export async function GET() {
  const ollamaUrl = await getSetting('ollamaUrl')
  const model = await getSetting('ollamaModel')

  const ai = getAIProvider()
  const healthy = await ai.checkHealth()

  let models: string[] = []
  if (healthy) {
    try {
      const res = await fetch(`${ollamaUrl}/api/tags`)
      if (res.ok) {
        const data = await res.json() as { models?: Array<{ name: string }> }
        models = data.models?.map((m) => m.name) ?? []
      }
    } catch {
      // ignore
    }
  }

  return NextResponse.json({
    healthy,
    url: ollamaUrl,
    currentModel: model,
    availableModels: models,
  })
}
