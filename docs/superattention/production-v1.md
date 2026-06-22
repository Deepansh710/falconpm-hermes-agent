# superattention.ai Production V1

Production V1 turns the static Growth Console into a working AI product.

## Product Definition

**superattention.ai** is an AI growth system for early D2C brands that turns attention into revenue.

V1 helps a founder:

- enter brand, product, audience, and revenue goal
- generate a 30-day growth plan with Anthropic
- save generated campaigns to Supabase
- copy weekly content and campaign assets
- manually track results and next actions

## Architecture

```text
Browser
  -> Vercel static frontend
  -> Vercel API route /api/generate-plan
  -> Anthropic Messages API
  -> Supabase campaigns table
```

## Why This Is Production-Oriented

- AI API key stays server-side in Vercel.
- Supabase service role key stays server-side in Vercel.
- Browser never receives secret keys.
- Campaigns are persisted in Supabase.
- Static demo still works locally without backend setup.

## Required Services

- Vercel
- Supabase
- Anthropic API key

## Environment Variables

```text
ANTHROPIC_API_KEY
ANTHROPIC_MODEL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_CAMPAIGNS_TABLE
```

## Database

Run:

```text
apps/superattention-console/supabase/schema.sql
```

## Current Limits

V1 does not yet:

- authenticate users
- support team workspaces
- auto-post to social channels
- send WhatsApp/email campaigns
- generate final Reel videos
- sync real analytics automatically

## V2 Direction

V2 should add:

- brand profiles
- user authentication
- asset uploads
- asset-to-Reel storyboard generation
- saved weekly learning loops
- real campaign metrics ingestion
