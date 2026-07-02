# FalconPM / superattention.ai — Master PRD

**Last updated:** June 2026  
**Repo:** `Deepansh710/falconpm-hermes-agent` (Hermes fork)  
**Live console:** https://superattention.vercel.app  
**Console codebase:** `apps/superattention-console/`  
**Current `main` (console):** `b259ae976`  
**Product freeze ceiling:** **V1.8** (pilot-complete founder loop)

This document has **three parts**:

| Part | Audience | What it covers |
|------|----------|----------------|
| **I — Console** | Founders, product, UAT | superattention.ai web app — versions shipped, V1.8 left, pilot gate |
| **II — Agent** | Assignment / Hermes customization | FalconPM agent identity, skills, context — not the Vercel UI |
| **III — Ops** | Deploy, env, git, process | Vercel, Supabase, release train, what is explicitly out of scope |

---

# Part I — Console (superattention.ai)

## I.1 Product definition

**superattention.ai** is an AI growth command center for early Indian D2C founders. It turns attention into revenue through a **30-day execution loop**, not a strategy PDF.

**Core job:** Coach a solo founder from “I don’t know my customer” → structured brief → weekly plan → manual execution → tracked results → closed learnings → **smarter next plan**.

**Pilot brand:** The Pickle Romance (Faridabad pickles; hero SKU Aam ka Achar / Aam Romantics Combo).

**Pilot mission:**

> Reach **₹50,000 in 30 days** via Instagram Reels, Instagram Shopping, a one-page website, and WhatsApp ordering (Faridabad + Delhi NCR).

**Design principles:**

- Plain English in UI (no ICP/funnel jargon)
- Founder words preserved; AI rephrases and plans
- Never invent customer truth, prices, sizes, or phantom goals
- If customer is unknown → **Discovery Week** first, not a fake 30-day plan
- Founder executes manually (copy/paste WA, film Reels) — no auto-post in V1

## I.2 Surfaces

| Surface | Purpose |
|---------|---------|
| **Dashboard** | Goal ring, metrics, AI insight, campaign health warnings |
| **Brand Setup** | 5-step wizard → Review brief → Generate |
| **Campaign Console** | Diagnosis, weekly sprints, experiments, history, audit trail |
| **Content Studio** | Reels, WhatsApp, website, LinkedIn copy (copy buttons) |
| **Growth Tracker** | Manual metrics, save progress, structured close learnings |

## I.3 Technical stack (console only)

| Layer | Implementation |
|-------|----------------|
| Frontend | Static `index.html`, `app.js`, `styles.css` |
| Hosting | Vercel (`apps/superattention-console`) |
| APIs | `/api/generate-plan`, `/api/coach`, `/api/campaigns` |
| AI | Anthropic (server-side) |
| Persistence | Supabase `campaigns` table + `localStorage` drafts |
| Design reference | `stitch_superattention_ai_growth_console/` — **mockups only, not wired to deploy** |

## I.4 Version history — shipped

### V0 — Foundation

**Commits:** `97174a3d6`, `49ddf3022`, `2bb475a9a`, `fe4ee791c`, `53cca6781`, `09d8196a0`

- Stitch-style command-center UI (sidebar, 5 views, glassmorphism)
- Brand setup form; static demo (`python3 -m http.server`)
- Production: `/api/generate-plan` + Supabase save
- JSON plan reliability (retry/repair, token limits)
- Sample brand: The Pickle Romance
- Wizard step 5 → brief review fix

### V1.1 — Growth feedback loop (`9bb926b6d`)

- Experiment detail panel (week → modal)
- Campaign history UI (`GET /api/campaigns`, Load, Duplicate, Refresh)
- Close campaign → Supabase `metrics` (tracker + learnings)
- Prior learnings feed next `buildPrompt()`
- Brand story fields (mission, differentiation, stage, past failures)
- Setup guardrails; `api/campaigns.js`; `migration-v1.1.sql`

### V1.2 — Brand Coach & lifecycle (`19314d436`)

- **5-step wizard** (Basics → Customer → Offer → Goal → Story)
- Goal intelligence (recommended vs stretch)
- **Discovery Week** (modal, synthesize, gate + override)
- **Coach API** (`/api/coach.js`)
- Offer split: `productBundle` + `promoHook`
- One active campaign per brand; Stop / Delete / Run again
- Review brief gate before generate

### V1.3 — Coach expansion (`16833ff52`)

- Coaches: mission, differentiation, offer, goal, close debrief
- Loading UX; “Not sure” toggles; tone chips
- Step 5 single CTA; generate spinner

### V1.4 — Goal clarity & foolproof WhatsApp (`e16706c53`)

- Goal clarity UX (entered vs active; recommended vs stretch)
- Client-side `buildGoalNarrative()` (no invented micro-goals)
- Category dropdown + custom “Other”
- WA pack v1: message, photo brief, who/when/reply script
- Reel week backfill; channel filtering; price lock
- Pre-revenue recommended cap logic (~₹8K floor when revenue = 0)

### V1.5 — Trust + retention (`4e10b45bc`)

- Hide phantom goal until Step 4 meaningful
- Wizard auto-save + resume (`sa_draft_*`)
- Discovery teaching copy + findings persist
- Tracker draft save (`sa_tracker_*`)

### V1.6 — Foolproof execution (`bb6db2e56`)

- WA ops pack v2: YES reply, order confirm, delivery, objections, contact list
- Brief audit trail (“Plan built from”)
- Capacity guardrails + generate confirm on block mismatch
- SKU vs whole-brand scope + revenue labels
- `whereLive` → `deliveryArea` suggest
- Discovery minimum bar (thin notes confirm)

### V1.7 — Measurable growth loop (`9dcec38f0`)

- Week chip, progress bar, experiment checkboxes (`experimentProgress`)
- Mid-campaign save: `PATCH action: save_progress` → Supabase
- Structured close learnings (message, creative, channel, offer)
- “What we changed from last campaign” card
- Campaign health banner (behind pace, stale tracker 7d+)
- North-star metric on Step 4; `campaignStartedAt`

### Hotfix — Radio UI (`b259ae976`)

- Campaign scope + goal choice radios no longer stretched as full-width text fields

## I.5 Release train status

```text
✅ V0 – V1.7 + hotfix   on main
⬜ V1.8                 NOT SHIPPED — last item in freeze
🔒 FREEZE               after V1.8 + pilot gate
⬜ V2+                  platform & integrations
```

## I.6 V1.8 — planned (console)

**Theme:** Channel-native depth + reliability. **Depends on:** V1.7 ✅.

| # | Feature | Acceptance |
|---|---------|------------|
| 8.1 | **Primary channel per week** | Each week tagged WhatsApp-first or Reel-first; skip unchecked channels |
| 8.2 | **Reel script pack** | Hook + shot list + on-screen text + caption in plan + Content Studio |
| 8.3 | **Content Studio edit/export** | Inline edit; export weekly pack (HTML or print-friendly) |
| 8.4 | **Coach hardening** | “Rephrased your words only”; block invented prices/sizes on apply |
| 8.5 | **API error recovery** | Try again on failed generate/coach; friendly missing-key copy |

**Minimum V1.8 (if schedule slips):** ship **8.2 + 8.4 + 8.5** only; defer 8.1 and 8.3 to V2.

**V1.8 exit test:** Founder films Reel from script without rewriting; coach never changes ₹399 to ₹299.

## I.7 Known gaps (honest)

| Item | Status |
|------|--------|
| Weekly chart bars from real saves | **Not done** — `renderChartBars()` still uses placeholder data |
| Mobile UAT | Not formally signed off |
| `brandStage` on Step 5 vs goal on Step 4 | Stage unavailable during goal coaching (P2) |
| Per-week primary channel | AI has `summary.primaryChannel` only — no week UI until V1.8 |
| Content Studio edit/export | Copy-only until V1.8 |

## I.8 Pilot exit gate (after V1.8)

Do **not** open console V2 until:

1. Pickle Romance completes Discovery **or** confident customer step
2. Generates plan → executes **≥2 weeks** (checkboxes + tracker)
3. Closes campaign with structured learnings
4. Runs **second plan** without hand-holding
5. Returns within 7 days of close

Post-V1.8: **P0 bugs + P1 copy/spacing only** — no new capabilities without pilot evidence.

## I.9 Console API contract (current)

### `/api/coach`

`audience_draft` · `discovery_week` · `discovery_synthesize` · `failure_debrief` · `mission_draft` · `differentiation_draft` · `offer_draft` · `goal_coach` · `close_debrief`

### `/api/generate-plan`

POST `input` → plan JSON + Supabase save + `usedPriorLearnings` + `priorLearnings`

### `/api/campaigns`

| Action | Behavior |
|--------|----------|
| GET | List campaigns |
| PATCH `save_progress` | Mid-campaign tracker + experiments |
| PATCH `close` / learnings | Close campaign |
| PATCH `status` | live / paused / closed |
| DELETE | Remove row |

### Supabase `metrics` (evolved)

`status`, `closedAt`, `tracker`, `learnings`, `experimentProgress`, `manualWeek`, `trackerUpdatedAt`, `campaignStartedAt`, `northStarMetric`, pause/resume timestamps

---

# Part II — Agent (FalconPM on Hermes)

## II.1 Why this is separate from the Console

| | **Console** | **Agent (FalconPM)** |
|---|-------------|----------------------|
| **Surface** | Browser at superattention.vercel.app | Hermes CLI, TUI, gateway (Telegram, etc.) |
| **User** | Founder filling a wizard | You / power user in terminal or chat |
| **Customization** | `apps/superattention-console/*` | Context files, skills, `SOUL.md`, `MEMORY.md` |
| **Versioning** | V1.1–V1.8 release train | Hermes fork + assignment deliverable |
| **Assignment fit** | Product demo founders can click | “Fork Hermes → ship your own PM AI Agent” |

The console **implements** much of the growth loop in a guided UI. The agent **generalizes** the same PM thinking for open-ended chat and future automation without rebuilding Hermes core.

## II.2 Product definition (agent)

**FalconPM** is a Growth Product Manager AI Agent for D2C brands, built as a **Hermes fork** without rewriting the core runtime for V1.

**One-liner:** Turn product, audience, and sales goal into weekly growth experiments across Reels, offers, website messaging, and WhatsApp conversion.

**Assignment framing:**

> Fork Hermes and ship FalconPM — your own Product Manager AI Agent.

**V1 customization strategy** (from `docs/falconpm/hermes-fork-setup.md`):

- Context files, skills, examples, memory — **not** core `run_agent.py` changes unless unavoidable
- Preserve Hermes architecture and extension style (`AGENTS.md`)

## II.3 Agent identity & durable context

| File | Role |
|------|------|
| `SOUL.md` | Personality, beliefs, PM lens — strategic, commercial, honest |
| `MEMORY.md` | Durable Pickle Romance facts: brand, July goal, funnel, delivery, combo pricing |
| `AGENTS.md` | Fork rules + FalconPM V1 focus (Pickle Romance pilot) |
| `docs/the-pickle-romance/brand-context.md` | Full brand positioning, segments, funnel |
| `docs/the-pickle-romance/aam-romantics-30-day-campaign.md` | Reference 30-day campaign artifact (pre-console) |

## II.4 Primary skill

**`skills/productivity/d2c-growth-experiment-planner/SKILL.md`**

- Weekly experiment planner for D2C (content, offers, website, WhatsApp)
- Required inputs: brand, product, customer, goal, channel, order flow, capacity, delivery
- Output template: goal → insight → experiments with hypothesis, hook, CTA, metric, decision rule

Use when user asks for growth planning outside the console, or via Hermes CLI with skill loaded.

## II.5 Agent vs console — capability map

| Capability | Console | Agent |
|------------|:-------:|:-----:|
| 5-step wizard + coaches | ✅ | Via skill + chat (less structured) |
| Discovery Week UI | ✅ | Skill / manual conversation |
| 30-day JSON plan + Content Studio | ✅ | Text output via skill |
| Campaign history / Supabase | ✅ | ❌ (console-only persistence) |
| Close loop → next plan | ✅ | Memory + manual paste |
| Scheduled jobs / cron | ❌ | ✅ (Hermes native) |
| Multi-channel messaging | ❌ | ✅ (Hermes gateway) |

**Intent:** Console = pilot founder UX. Agent = assignment + long-term power user surface.

## II.6 Agent roadmap (post-pilot, not V1.8 console freeze)

From early scope agreement — **V2+ for agent**, not mixed into console V1.8:

- Competitor Reel research
- Customer review analysis
- Shopify product page suggestions
- UGC creator briefs
- New SKU launch plans
- Repeat-purchase experiments
- Multi-brand D2C templates
- Native IG / Shopify / WA / analytics integrations (requires Hermes plugins or MCP)

**Runtime changes** (only when needed — `hermes-fork-setup.md`):

- Custom memory behavior for campaign learnings
- Multi-brand workspace switching
- Channel integrations as plugins, not core patches

## II.7 Agent deliverables checklist (assignment)

| Deliverable | Location / status |
|-------------|-------------------|
| Hermes fork on GitHub | `Deepansh710/falconpm-hermes-agent` ✅ |
| Agent identity | `SOUL.md`, `MEMORY.md`, `AGENTS.md` ✅ |
| D2C growth skill | `skills/productivity/d2c-growth-experiment-planner/` ✅ |
| Brand context | `docs/the-pickle-romance/` ✅ |
| Working product demo | superattention.ai console on Vercel ✅ |
| Demo prompt file | Referenced in `hermes-fork-setup.md` as `examples/falconpm/the-pickle-romance-demo.md` — **path documented; verify file exists before demo** |

---

# Part III — Ops

## III.1 Repositories & deploy

| Item | Value |
|------|--------|
| **Canonical fork** | `https://github.com/Deepansh710/falconpm-hermes-agent` |
| **Deploy branch** | `main` on **your fork** (not `NousResearch/hermes-agent`) |
| **Live URL** | https://superattention.vercel.app |
| **Vercel root directory** | `apps/superattention-console` |
| **Build command** | None (static + serverless API routes) |
| **Wrong upstream PR** | Do not PR FalconPM/Pickle/console work to NousResearch — close if opened by mistake |

## III.2 Environment variables (Vercel)

From `apps/superattention-console/.env.example`:

```text
ANTHROPIC_API_KEY
ANTHROPIC_MODEL          # e.g. claude-3-haiku-20240307
ANTHROPIC_MAX_TOKENS     # optional; haiku capped lower in code

SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_CAMPAIGNS_TABLE # default: campaigns
```

**Rules:**

- Never expose API keys or service role key in browser code
- Supabase RLS blocks public access; only serverless routes use service role

## III.3 Database

1. Run `apps/superattention-console/supabase/schema.sql` in Supabase SQL Editor
2. Optional: `migration-v1.1.sql` if migrating older deployments
3. Table: `campaigns` with `plan_text`, `input_payload`, `metrics` jsonb

## III.4 Local development

```bash
cd apps/superattention-console
python3 -m http.server 5178
# → http://127.0.0.1:5178  (static demo; APIs need Vercel or local serverless shim)
```

Hermes agent (separate):

```bash
source .venv/bin/activate   # or venv
hermes                      # CLI/TUI per Hermes docs
```

## III.5 Release train process (agreed)

1. Branch from fork `main`: `cursor/sa-v1.x-short-description`
2. Implement **one version theme only** (no V1.6 scope in V1.5 branch)
3. `node --check` on changed JS files
4. Commit → push → merge to fork `main`
5. UAT on production (hard refresh)
6. Pilot bugs only after V1.8 freeze

**Version commit map (console):**

| Version | Commit |
|---------|--------|
| V1.1 | `9bb926b6d` |
| V1.2 | `19314d436` |
| V1.3 | `16833ff52` |
| V1.4 | `e16706c53` |
| V1.5 | `4e10b45bc` |
| V1.6 | `bb6db2e56` |
| V1.7 | `9dcec38f0` |
| Radio hotfix | `b259ae976` |

## III.6 Explicitly out of scope (until post-pilot)

### Console + product

| Item | Target |
|------|--------|
| Google auth / multi-brand profiles | V2 |
| CEO dashboard | V2 |
| Vision LLM / image upload | V2 |
| Competitor web automation | V2 (Discovery substitute text enough for pilot) |
| IG / WA Business API | V3 |
| Real analytics sync | V3 |
| MP4 / storyboard generation | V2 (`README.md`) |
| Stitch HTML folder in production | Never — design reference only |

### Ops exceptions (allowed during freeze)

- Deploy / env reliability
- Security (keys, rate limits)
- Copy and teaching text tweaks
- P0 pilot bugs blocking the frozen journey
- P1 polish (spacing, mobile) in small batches

## III.7 UAT rollup (console)

| # | Test | Done? |
|---|------|-------|
| 1 | Empty dashboard — no phantom goal | ✅ V1.5+ |
| 2 | Refresh mid-wizard — data restored | ✅ V1.5+ |
| 3 | Discovery notes survive refresh | ✅ V1.5+ |
| 4 | WA YES → order flow messages | ✅ V1.6+ |
| 5 | Plan inputs on Campaign Console | ✅ V1.6+ |
| 6 | Save progress without close | ✅ V1.7 |
| 7 | Close → next plan “what changed” | ✅ V1.7 |
| 8 | Scope/goal radios layout | ✅ hotfix |
| 9 | Reel script + shots | ⬜ V1.8 |
| 10 | Coach never invents price (hard block) | ⬜ V1.8 |
| 11 | API Try again | ⬜ V1.8 |
| 12 | Full 30-day pilot loop | ⬜ post-V1.8 |

## III.8 Related docs

| Doc | Purpose |
|-----|---------|
| `docs/superattention/production-v1.md` | Original production V1 architecture summary |
| `apps/superattention-console/README.md` | Console setup & V2 direction |
| `docs/falconpm/hermes-fork-setup.md` | Agent fork wiring |
| `docs/the-pickle-romance/brand-context.md` | Pilot brand facts |
| `AGENTS.md` | Hermes contributor + FalconPM fork rules |

## III.9 Stakeholder one-liner

> We are not building a platform until one founder completes a full growth loop on superattention without hand-holding.

---

## Document maintenance

- Update **Part I** when shipping V1.8 or hotfixes on console
- Update **Part II** when adding agent skills, context, or assignment artifacts
- Update **Part III** when deploy target, env, or process changes
- Keep `stitch_superattention_ai_growth_console/` out of versioned product scope unless explicitly integrated
