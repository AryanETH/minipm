import type {
  AIProvider,
  AIAnalysisResult,
  AIGeneratedContent,
  AuthorProfile,
} from './types'

export class OllamaProvider implements AIProvider {
  name = 'ollama'
  private baseUrl: string
  private model: string
  private temperature: number

  constructor(
    baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    model = process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b',
    temperature = 0.7
  ) {
    this.baseUrl = baseUrl
    this.model = model
    this.temperature = temperature
  }

  // Re-read settings each call so DB changes take effect without restart
  private getBaseUrl() {
    return this.baseUrl
  }
  private getModel() {
    return this.model
  }

  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${this.getBaseUrl()}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  private async generate(prompt: string): Promise<string> {
    const res = await fetch(`${this.getBaseUrl()}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.getModel(),
        prompt,
        stream: false,
        options: { temperature: this.temperature },
      }),
      signal: AbortSignal.timeout(120_000),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText)
      throw new Error(`Ollama error ${res.status}: ${errText}`)
    }
    // Guard against empty or non-JSON responses (e.g. Ollama returns empty body on timeout/interrupt)
    const raw = await res.text().catch(() => '')
    if (!raw || !raw.trim()) {
      throw new Error('Ollama returned an empty response body')
    }
    let data: { response?: string }
    try {
      data = JSON.parse(raw) as { response?: string }
    } catch {
      throw new Error(`Ollama response is not valid JSON: ${raw.slice(0, 200)}`)
    }
    if (!data.response) throw new Error('Ollama returned empty response')
    return data.response
  }

  private extractJSON(text: string): string {
    // Strip thinking/reasoning tags that some models emit (Qwen, DeepSeek, etc.)
    const stripped = text
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
      .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
      .trim()

    // Try to extract JSON from markdown code blocks first
    const codeBlock = stripped.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlock) return codeBlock[1].trim()
    // Try to find raw JSON object
    const jsonMatch = stripped.match(/\{[\s\S]*\}/)
    if (jsonMatch) return jsonMatch[0]
    return stripped
  }

  async analyzeComment(
    comment: string,
    videoTitle: string
  ): Promise<AIAnalysisResult> {
    const prompt = `You are a content analyst. Analyze the YouTube comment below and output ONLY a JSON object.

RULES:
- Output ONLY the JSON object, nothing else
- No markdown, no code blocks, no explanation, no thinking
- All scores are integers 0-10
- overall_score uses: insight*0.30 + novelty*0.25 + viral*0.20 + relatability*0.15 + originality*0.10

Video title: ${videoTitle}
Comment: ${comment}

Output this exact JSON structure:
{"insight_score":7,"novelty_score":6,"relatability_score":7,"controversy_score":5,"viral_score":6,"originality_score":6,"overall_score":6.4,"category":"AI","core_idea":"one sentence summary of the underlying idea","reason":"why this is or isn't interesting to repost","should_use":true}

category must be one of: AI, startups, technology, products, founders, other
should_use is true if overall_score >= 6.0

JSON:`

    const raw = await this.generate(prompt)
    const json = this.extractJSON(raw)

    let parsed: AIAnalysisResult
    try {
      parsed = JSON.parse(json) as AIAnalysisResult
    } catch {
      // Ollama returned garbled output — build a neutral fallback score so the
      // comment is still marked processed and doesn't block the pipeline
      parsed = {
        insight_score: 3,
        novelty_score: 3,
        relatability_score: 3,
        controversy_score: 3,
        viral_score: 3,
        originality_score: 3,
        overall_score: 3,
        category: 'other',
        core_idea: comment.slice(0, 120),
        reason: 'Could not parse AI response — scored conservatively',
        should_use: false,
      } as AIAnalysisResult
    }

    // Ensure overall_score is computed with weights if missing
    if (!parsed.overall_score) {
      parsed.overall_score =
        parsed.insight_score * 0.3 +
        parsed.novelty_score * 0.25 +
        parsed.viral_score * 0.2 +
        parsed.relatability_score * 0.15 +
        parsed.originality_score * 0.1
    }
    return parsed
  }

  async generateContent(
    coreIdea: string,
    profile: AuthorProfile
  ): Promise<AIGeneratedContent> {
    const prompt = `You are a content writer with this profile:
- Name: ${profile.name}
- Topics: ${profile.topics.join(', ')}
- Writing style: ${profile.writingStyle.join(', ')}
- Avoid: ${profile.avoidTopics.join(', ')}

Core idea to transform: "${coreIdea}"

Create ORIGINAL content that expresses YOUR OWN perspective on this idea. Do NOT paraphrase the source. Extract the underlying concept and write from your own builder/founder point of view.

Return ONLY this JSON (no markdown, no extra text):
{
  "xContent": "<tweet under 280 chars, strong first line, opinionated, conversational, no excessive hashtags>",
  "linkedinContent": "<100-300 word LinkedIn post, good hook, short paragraphs, original insight, no generic motivational ending, max 2 relevant hashtags>",
  "imageHeadline": "<5-8 word punchy headline in ALL CAPS>",
  "imageSubheadline": "<8-15 word supporting line>",
  "imageFooter": "<your handle or short attribution>"
}`

    const raw = await this.generate(prompt)
    const json = this.extractJSON(raw)

    let parsed: AIGeneratedContent
    try {
      parsed = JSON.parse(json) as AIGeneratedContent
    } catch {
      // Ollama returned garbled output — build a minimal fallback so the draft
      // is still created and the user can edit it manually
      const fallbackIdea = coreIdea.slice(0, 200)
      parsed = {
        xContent: fallbackIdea.slice(0, 280),
        linkedinContent: fallbackIdea,
        imageHeadline: profile.name.toUpperCase(),
        imageSubheadline: fallbackIdea.slice(0, 80),
        imageFooter: profile.handle,
      }
    }

    // Ensure no field is undefined/null — fill blanks so the DB write never fails
    parsed.xContent = parsed.xContent?.trim() || coreIdea.slice(0, 280)
    parsed.linkedinContent = parsed.linkedinContent?.trim() || coreIdea
    parsed.imageHeadline = parsed.imageHeadline?.trim() || profile.name.toUpperCase()
    parsed.imageSubheadline = parsed.imageSubheadline?.trim() || coreIdea.slice(0, 80)
    parsed.imageFooter = parsed.imageFooter?.trim() || profile.handle

    return parsed
  }

  async refineContent(
    content: string,
    instruction: string,
    platform: 'x' | 'linkedin'
  ): Promise<string> {
    const limit =
      platform === 'x' ? 'Keep it under 280 characters.' : 'Keep it 100-300 words.'
    const prompt = `Refine this ${platform === 'x' ? 'X (Twitter)' : 'LinkedIn'} post.

Original:
"${content}"

Instruction: ${instruction}
${limit}

Return ONLY the refined post text, no explanation:`

    const raw = await this.generate(prompt)
    return raw.trim().replace(/^["']|["']$/g, '')
  }
}

export function createOllamaProvider(
  overrides?: Partial<{ baseUrl: string; model: string; temperature: number }>
): OllamaProvider {
  return new OllamaProvider(
    overrides?.baseUrl,
    overrides?.model,
    overrides?.temperature
  )
}
