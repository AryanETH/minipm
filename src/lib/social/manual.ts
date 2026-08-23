// Manual provider — user copies and pastes manually
import type { SocialProvider, SocialPost, PublishResult } from './types'

export class ManualProvider implements SocialProvider {
  constructor(public platform: 'X' | 'LINKEDIN') {}

  isConfigured(): boolean {
    return true // always available
  }

  async publishPost(_post: SocialPost): Promise<PublishResult> {
    // In manual mode, we just return success — the UI handles copy/mark as posted
    return { success: true }
  }

  async publishImagePost(_post: Required<SocialPost>): Promise<PublishResult> {
    return { success: true }
  }

  async deletePost(_externalId: string): Promise<boolean> {
    return true
  }
}

export function createManualProvider(
  platform: 'X' | 'LINKEDIN'
): ManualProvider {
  return new ManualProvider(platform)
}
