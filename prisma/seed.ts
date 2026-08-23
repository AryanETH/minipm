import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'content.db')
const adapter = new PrismaBetterSqlite3({ url: dbPath })
const prisma = new PrismaClient({ adapter })

const DEFAULT_SETTINGS: Record<string, string> = {
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'qwen2.5-coder:7b',
  ollamaTemperature: '0.7',
  minContentScore: '7.5',
  commentsPerVideo: '100',
  videosPerSource: '10',
  scanFrequencyMinutes: '60',
  topics: 'AI,startups,consumer technology,products,building apps,AI agents,technology observations,founder journeys',
  writingStyle: 'simple English,short sentences,conversational,strong observations,builder/founder perspective,sometimes contrarian,curiosity-driven',
  avoidTopics: 'generic motivational content,corporate buzzwords,fake storytelling',
  blockedWords: '',
  authorName: 'Creator',
  authorHandle: '@creator',
  defaultTemplate: 'minimal-dark',
  minCommentLength: '30',
  minCommentLikes: '0',
  blockedPhrases: 'great video,first,nice video,great content,bro cooked,keep it up',
  defaultPostingTimes: '09:30,13:00,18:30',
  timezone: 'Asia/Kolkata',
}

async function main() {
  console.log('Seeding default settings...')
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.settings.upsert({
      where: { key },
      create: { key, value },
      update: {},
    })
  }
  console.log('✓ Default settings seeded')

  // Create a default AI profile
  const existing = await prisma.aIProfile.findFirst()
  if (!existing) {
    await prisma.aIProfile.create({
      data: {
        authorName: 'Creator',
        handle: '@creator',
        topics: 'AI,startups,technology,products',
        writingStyle: 'simple,conversational,opinionated',
        avoidTopics: 'generic motivational content,corporate buzzwords',
        blockedWords: '',
      },
    })
    console.log('✓ Default AI profile created')
  }

  console.log('\n✓ Seed complete. Start the app with: npm run dev')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
