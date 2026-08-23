# Content Engine

A local-first AI-powered content intelligence dashboard.

**YouTube comments → AI analysis → Original posts → X & LinkedIn**

Runs entirely on your Windows laptop. No paid SaaS. No cloud. ₹0/month.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy and configure environment
copy .env.example .env
# Edit .env — add YOUTUBE_API_KEY

# 3. Initialize database
npx prisma migrate dev --name init
npx tsx prisma/seed.ts

# 4. Start Ollama (separate terminal)
ollama pull qwen2.5-coder:7b
ollama serve

# 5. Start the app
npm run dev
```

Open **http://localhost:3000**

---

## What it does

1. **Discover** — Scans YouTube channels, videos, and keywords via the official API
2. **Filter** — Removes spam, emoji-only, and low-value comments automatically  
3. **Analyze** — Ollama LLM scores every comment (insight, novelty, virality, originality)
4. **Inbox** — Review top ideas with scores and AI reasoning
5. **Generate** — One click creates X post + LinkedIn post + image card text
6. **Edit** — Refine drafts with AI actions (shorten, expand, more controversial...)
7. **Queue** — Schedule posts with date/time picker
8. **Publish** — Copy → post manually → mark as posted (API publishing in Phase 2)

---

## Stack

- **Next.js 16** + TypeScript + Tailwind CSS
- **SQLite** + Prisma 7 (local database, no cloud)
- **Ollama** for local AI (qwen2.5-coder:7b, llama3, gemma3)
- **YouTube Data API v3** for content discovery
- **HTML/CSS templates** for image cards (no paid design APIs)
- **n8n** for automation workflows (optional)

---

## Full Setup Guide

See [docs/SETUP.md](docs/SETUP.md)
