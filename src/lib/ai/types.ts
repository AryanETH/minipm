export interface AIAnalysisResult {
  insight_score: number
  novelty_score: number
  relatability_score: number
  controversy_score: number
  viral_score: number
  originality_score: number
  overall_score: number
  category: string
  core_idea: string
  reason: string
  should_use: boolean
}

export interface AIGeneratedContent {
  xContent: string
  linkedinContent: string
  imageHeadline: string
  imageSubheadline: string
  imageFooter: string
}

export interface AIProvider {
  name: string
  analyzeComment(comment: string, videoTitle: string): Promise<AIAnalysisResult>
  generateContent(
    coreIdea: string,
    authorProfile: AuthorProfile
  ): Promise<AIGeneratedContent>
  refineContent(
    content: string,
    instruction: string,
    platform: 'x' | 'linkedin'
  ): Promise<string>
  checkHealth(): Promise<boolean>
}

export interface AuthorProfile {
  name: string
  handle: string
  topics: string[]
  writingStyle: string[]
  avoidTopics: string[]
  blockedWords: string[]
}
