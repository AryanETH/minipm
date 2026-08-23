export * from './types'
export * from './ollama'

import { OllamaProvider } from './ollama'
import type { AIProvider } from './types'

// Always create fresh from current settings — avoids stale env reads
export function getAIProvider(overrides?: {
  baseUrl?: string
  model?: string
  temperature?: number
}): AIProvider {
  return new OllamaProvider(overrides?.baseUrl, overrides?.model, overrides?.temperature)
}
