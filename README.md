# Gork Personal Assistant

Internal, multi-channel assistant built on Next.js API routes. It handles incoming webhooks (SMS and Telegram) and can use tools for Slack, Notion, Linear, Gmail/Calendar, and knowledge retrieval.

## Requirements

- Bun (recommended runtime + package manager)
- Next.js 16 runtime

## Setup

Install dependencies:

```bash
bun install
```

Create a `.env` file with the required variables (see below).

Run locally:

```bash
bun run dev
```

Build and start:

```bash
bun run build
bun run start
```

## API Routes

- `POST /api/sms` — Twilio webhook (form-encoded)
- `POST /api/telegram` — Telegram bot webhook (JSON)

## Environment Variables

These are required depending on which integrations you enable:

- **Core**
  - `CLAUDE_API_KEY`
  - `SUPERMEMORY_API_KEY` (optional; enables memory context)
- **SMS (Twilio)**
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_PHONE_NUMBER`
- **Telegram**
  - `TELEGRAM_BOT_TOKEN`
- **Slack**
  - `SLACK_BOT_TOKEN`
  - `SLACK_SIGNING_SECRET`
- **Notion**
  - `NOTION_API_KEY`
  - `NOTION_INDEX_DATABASE_ID`
  - `NOTION_TODO_DATABASE_ID`
  - `NOTION_PARENT_PAGE_ID`
  - `NOTION_AREA_PAGE_IDS` (JSON map of area name → page ID)
- **Linear**
  - `LINEAR_API_KEY`
  - `LINEAR_TEAM_ID`
- **Google**
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_REFRESH_TOKEN`

## Notes

- This service is API-only (no UI routes by default).
- Incoming webhook handlers process messages asynchronously and send responses back through the provider.
