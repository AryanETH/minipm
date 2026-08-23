export * from './types'
export * from './manual'

import { ManualProvider } from './manual'
import type { SocialProvider } from './types'

export function getSocialProvider(platform: 'X' | 'LINKEDIN'): SocialProvider {
  // For V1, always use manual mode
  // In V2, check env vars for API credentials and swap in real providers
  return new ManualProvider(platform)
}
