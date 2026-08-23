export interface FilterConfig {
  minLength: number
  minLikes: number
  blockedPhrases: string[]
  blockedPatterns: RegExp[]
}

export const DEFAULT_FILTER_CONFIG: FilterConfig = {
  minLength: 30,
  minLikes: 0,
  // Only exact/standalone low-value phrases — use word boundaries in the check
  blockedPhrases: [
    'great video',
    'nice video',
    'great content',
    'amazing video',
    'bro cooked',
    'keep it up',
    'check out my channel',
    'link in bio',
    'loved this video',
    'fire video',
    'w video',
    'l video',
  ],
  blockedPatterns: [
    /^[\p{Emoji}\s]+$/u,       // Emoji-only
    /^https?:\/\/\S+\s*$/i,   // URL only (entire comment is just a link)
    /(.)\1{5,}/,               // Character repetition (aaaaaa) - raised to 5+
    /^[^a-zA-Z]{0,5}$/,       // Essentially no alphabetic content (very short)
  ],
}

export interface FilterResult {
  passed: boolean
  reason?: string
}

/** Strip YouTube HTML entities and tags from comment text before analysis */
export function cleanCommentText(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')         // strip any HTML tags
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, '')          // other numeric entities
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function filterComment(
  rawText: string,
  config: FilterConfig = DEFAULT_FILTER_CONFIG
): FilterResult {
  const clean = cleanCommentText(rawText)

  // Too short (measure after cleaning HTML)
  if (clean.length < config.minLength) {
    return { passed: false, reason: `Too short (${clean.length} chars)` }
  }

  // Blocked patterns
  for (const pattern of config.blockedPatterns) {
    if (pattern.test(clean)) {
      return { passed: false, reason: 'Matches blocked pattern' }
    }
  }

  // Blocked phrases — require word boundaries so "first" doesn't kill
  // "This is the first time I've seen this approach..."
  const lower = clean.toLowerCase()
  for (const phrase of config.blockedPhrases) {
    // Build a word-boundary-aware check: phrase must be the whole comment or
    // surrounded by non-word chars
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const boundary = new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, 'i')
    if (boundary.test(lower) && clean.length < 80) {
      // Only filter short comments that ARE basically just this phrase
      return { passed: false, reason: `Low-value phrase: "${phrase}"` }
    }
  }

  // Pure promotional: multiple links
  if ((clean.match(/https?:\/\//gi) || []).length >= 2) {
    return { passed: false, reason: 'Multiple links (promotion)' }
  }

  // Engagement bait
  if (/\b(smash the like|hit the bell|subscribe for more|drop a like)\b/i.test(clean)) {
    return { passed: false, reason: 'Engagement bait' }
  }

  // Excessive caps (spam-like) — only flag if comment has enough letters
  const upperCount = (clean.match(/[A-Z]/g) || []).length
  const letterCount = (clean.match(/[a-zA-Z]/g) || []).length
  if (letterCount > 20 && upperCount / letterCount > 0.85) {
    return { passed: false, reason: 'Excessive caps (spam-like)' }
  }

  return { passed: true }
}

export function computeSimilarity(a: string, b: string): number {
  const tokenize = (s: string) =>
    new Set(s.toLowerCase().match(/\b\w+\b/g) || [])
  const setA = tokenize(a)
  const setB = tokenize(b)
  const intersection = [...setA].filter((t) => setB.has(t)).length
  const union = new Set([...setA, ...setB]).size
  return union === 0 ? 0 : intersection / union
}
