# superattention.ai Growth Console

This is the V1 frontend demo for **superattention.ai**, an AI growth system for early D2C brands.

The console turns the FalconPM / superattention strategy into a product interface:

- brand dashboard
- 30-day campaign plan
- content studio
- WhatsApp, website, Reel, and LinkedIn copy
- manual growth tracker
- V2 preview for asset-to-Reel creation

## Run Locally

From this directory:

```bash
python3 -m http.server 5178
```

Then open:

```text
http://127.0.0.1:5178
```

## V1 Scope

V1 now supports two modes:

- Static demo mode when opened with `python3 -m http.server`.
- Production mode on Vercel with Anthropic generation and Supabase persistence.

It shows how superattention.ai can help The Pickle Romance plan and execute the Aam Romantics campaign, and it can generate new campaign plans when the backend environment is configured.

## Production Setup

Recommended deployment:

```text
Vercel frontend + Vercel serverless API routes + Supabase database
```

### 1. Create Supabase Table

In Supabase SQL Editor, run:

```text
supabase/schema.sql
```

### 2. Configure Environment Variables

In Vercel, add:

```text
ANTHROPIC_API_KEY
ANTHROPIC_MODEL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_CAMPAIGNS_TABLE
```

Use `.env.example` as the template.

Never expose `ANTHROPIC_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` in browser code.

### 3. Deploy On Vercel

Set the project root to:

```text
apps/superattention-console
```

No build command is required for the static frontend.

### 4. Production Capabilities

When deployed with environment variables, V1 can:

- collect brand and growth goal inputs
- call Anthropic securely through `/api/generate-plan`
- save generated campaigns to Supabase
- fetch recent saved campaigns through `/api/campaigns`

## V2 Direction

V2 should add:

- AI generation for new products and goals
- product photo/video uploads
- asset-to-Reel storyboard generation
- MP4 export
- multi-brand profiles
- saved weekly learnings
