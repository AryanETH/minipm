export interface SocialPost {
  content: string
  imageFilePath?: string
}

export interface PublishResult {
  success: boolean
  externalId?: string
  url?: string
  error?: string
}

export interface SocialProvider {
  platform: 'X' | 'LINKEDIN'
  publishPost(post: SocialPost): Promise<PublishResult>
  publishImagePost(post: Required<SocialPost>): Promise<PublishResult>
  deletePost(externalId: string): Promise<boolean>
  isConfigured(): boolean
}
