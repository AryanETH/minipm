# Content Engine — Setup Guide

A local-first AI-powered content intelligence dashboard.  
Runs entirely on your Windows laptop at ₹0/month.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | https://nodejs.org |
| npm | 8+ | included with Node |
| Ollama | latest | https://ollama.com |
| n8n (optional) | latest | `npm install -g n8n` |

---

## 1. Clone / Open Project

```
cd "content-engine"
```

---

## 2. Install Dependencies

```bash
npm install
```

---

## 3. Configure Environment

Copy `.env.example` to `.env`:

```bash
copy .env.example .env
```

Edit `.env` and set your YouTube API Key:

```env
DATABASE_URL="file:./content.db"
YOUTUBE_API_KEY="AIzaSy..."
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="qwen2.5-coder:7b"
NEXT_PUBLIC_APP_NAME="Content Engine"
```

**Getting a YouTube API Key:**
1. Go to https://console.cloud.google.com
2. Create a project → Enable "YouTube Data API v3"
3. Create credentials → API Key
4. Paste it in `.env`

---

## 4. Initialize Database

```bash
npx prisma migrate dev --name init
npx tsx prisma/seed.ts
```

---

## 5. Start Ollama

```bash
# Install Ollama from https://ollama.com
# Then pull a model:
ollama pull qwen2.5-coder:7b

# Start the Ollama server (runs in background):
ollama serve
```

Recommended models:
- `qwen2.5-coder:7b` — fast, good quality (default)
- `llama3.2` — balanced
- `gemma3` — lightweight

---

## 6. Start the App

```bash
npm run dev
```

Open: **http://localhost:3000**

---

## 7. First Steps

1. Go to **Settings** → add your YouTube API key, set author name/handle
2. Go to **Sources** → add YouTube channels (e.g. `@ycombinator`, `@lexfridman`)
3. Click **Scan** on a source to collect comments
4. Go to **Content Inbox** → click **Analyze Comments** (needs Ollama running)
5. Review ideas → click **Create Post** on high-scoring ones
6. Edit drafts in the **Draft Editor**
7. Add to **Queue** and mark as posted

---

## 8. n8n Automation (Optional, Phase 2)

Install n8n locally:
```bash
npm install -g n8n
n8n start
```

Open: **http://localhost:5678**

### Workflow A — Discovery
Trigger: Schedule (every 60 min)  
→ HTTP Request: `POST http://localhost:3000/api/n8n`  
→ Body: `{"action": "scan_all"}`  
→ Header: `x-n8n-secret: content-engine-local`

### Workflow B — Processing  
Trigger: Schedule (every 30 min)  
→ HTTP Request: `POST http://localhost:3000/api/n8n`  
→ Body: `{"action": "process_comments", "batchSize": 20}`

### Workflow C — Queue Check  
Trigger: Schedule (every 10 min)  
→ HTTP Request: `POST http://localhost:3000/api/n8n`  
→ Body: `{"action": "check_queue"}`  
→ If posts due: send desktop notification / email

Set `N8N_SECRET` in your `.env` to secure the endpoint.

---

## Image Generation

Images are rendered as HTML/CSS templates in the browser.

To generate PNG files (Phase 2):
```bash
npm install playwright
npx playwright install chromium
```

Then use the `/api/image-preview` endpoint to render and screenshot.

---

## Database Management

```bash
# Open Prisma Studio (visual DB browser)
npm run db:studio

# Reset and re-migrate
npx prisma migrate reset

# View migration status
npx prisma migrate status
```

Database file: `content.db` (SQLite, stays local)

---

## Project Structure

```
content-engine/
├── prisma/
│   ├── schema.prisma     — Database models
│   ├── migrations/       — SQL migration files
│   └── seed.ts           — Default data seeder
├── src/
│   ├── app/              — Next.js App Router pages
│   │   ├── api/          — API routes
│   │   ├── sources/      — Sources page
│   │   ├── inbox/        — Content Inbox
│   │   ├── drafts/       — Draft list + editor
│   │   ├── queue/        — Post queue
│   │   ├── posted/       — Published posts
│   │   ├── analytics/    — Analytics
│   │   ├── templates/    — Image templates
│   │   └── settings/     — Settings
│   ├── components/       — React components
│   ├── lib/
│   │   ├── ai/           — AI provider abstraction
│   │   ├── youtube/      — YouTube API client
│   │   ├── social/       — Social provider abstraction
│   │   ├── images/       — HTML image templates
│   │   ├── db.ts         — Prisma client
│   │   ├── filter.ts     — Comment filter
│   │   └── settings.ts   — Settings management
│   └── ...
├── docs/
│   └── SETUP.md
├── .env.example
├── prisma.config.ts
└── package.json
```

---

## Content Pipeline

```
YouTube videos/comments
    ↓
Collect comments (YouTube Data API v3)
    ↓
Rule-based filter (length, spam, engagement bait)
    ↓
Ollama AI analysis (JSON scoring)
    ↓
Score ≥ 7.5 → Content Inbox
    ↓
Click "Create Post" → Ollama generates drafts
    ↓
Draft Editor (edit, refine with AI)
    ↓
Add to Queue (scheduled or manual)
    ↓
Copy & post manually → Mark as posted
```

---

## Troubleshooting

**"Ollama is not running"**  
→ Run `ollama serve` in a terminal

**"YOUTUBE_API_KEY is not configured"**  
→ Add your key in Settings or `.env`

**Comments not collecting**  
→ Check API key quota in Google Cloud Console  
→ Some videos have disabled comments

**AI scores seem off**  
→ Try a different model in Settings → AI → Model  
→ Increase temperature slightly (0.8–1.0)

**Build errors after pulling updates**  
→ Run `npx prisma generate` then `npm run build`
