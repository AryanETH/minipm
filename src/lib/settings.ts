import { prisma } from './db'

export interface AppSettings {
  // YouTube
  youtubeApiKey: string
  commentsPerVideo: number
  videosPerSource: number
  scanFrequencyMinutes: number
  // AI
  ollamaUrl: string
  ollamaModel: string
  ollamaTemperature: number
  minContentScore: number
  // Content
  topics: string
  writingStyle: string
  blockedWords: string
  avoidTopics: string
  // Scheduling
  defaultPostingTimes: string
  timezone: string
  // Image
  authorName: string
  authorHandle: string
  authorAvatarUrl: string
  advertLogoUrl: string
  bgImageUrl: string
  defaultTemplate: string
  // Filter
  minCommentLength: number
  minCommentLikes: number
  blockedPhrases: string
}

const DEFAULTS: AppSettings = {
  youtubeApiKey: '',
  commentsPerVideo: 100,
  videosPerSource: 10,
  scanFrequencyMinutes: 60,
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'qwen2.5-coder:7b',
  ollamaTemperature: 0.7,
  minContentScore: 7.5,
  topics: 'AI,startups,consumer technology,products,building apps,AI agents,technology observations,founder journeys',
  writingStyle: 'simple English,short sentences,conversational,strong observations,builder/founder perspective,sometimes contrarian,curiosity-driven',
  blockedWords: '',
  avoidTopics: 'generic motivational content,corporate buzzwords,fake storytelling',
  defaultPostingTimes: '09:30,13:00,18:30',
  timezone: 'Asia/Kolkata',
  authorName: 'Creator',
  authorHandle: '@creator',
  authorAvatarUrl: '',
  advertLogoUrl: '',
  bgImageUrl: '',
  defaultTemplate: 'minimal-dark',
  minCommentLength: 30,
  minCommentLikes: 0,
  blockedPhrases: 'great video,first,nice video,great content,bro cooked,keep it up',
}

export async function getSetting<K extends keyof AppSettings>(
  key: K
): Promise<AppSettings[K]> {
  const row = await prisma.settings.findUnique({ where: { key } })
  if (!row) return DEFAULTS[key]
  const defaultVal = DEFAULTS[key]
  if (typeof defaultVal === 'number') return Number(row.value) as AppSettings[K]
  return row.value as AppSettings[K]
}

export async function getAllSettings(): Promise<AppSettings> {
  const rows = await prisma.settings.findMany()
  const map: Record<string, string> = {}
  for (const r of rows) map[r.key] = r.value
  const result = { ...DEFAULTS }
  for (const key of Object.keys(DEFAULTS) as (keyof AppSettings)[]) {
    if (map[key] !== undefined) {
      if (typeof DEFAULTS[key] === 'number') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(result as any)[key] = Number(map[key])
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(result as any)[key] = map[key]
      }
    }
  }
  return result
}

export async function setSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K]
): Promise<void> {
  await prisma.settings.upsert({
    where: { key },
    create: { key, value: String(value) },
    update: { value: String(value) },
  })
}

export async function setSettings(
  updates: Partial<AppSettings>
): Promise<void> {
  const ops = Object.entries(updates).map(([key, value]) =>
    prisma.settings.upsert({
      where: { key },
      create: { key, value: String(value) },
      update: { value: String(value) },
    })
  )
  await prisma.$transaction(ops)
}
