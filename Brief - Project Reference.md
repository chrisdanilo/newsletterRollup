# Brief (NewsletterRollup) — Project Reference

> **Last updated:** 2026-03-27
> **Repository:** `newsletterRollup`
> **Domain:** usebrief.me
> **Branch:** `claude/setup-newsletter-rollup-FEyBf`

---

## 1. Purpose

Brief is a personal newsletter digest tool. Users forward their newsletter subscriptions to a unique `@usebrief.me` address, and Brief:

1. **Receives** the email via SendGrid Inbound Parse webhook
2. **Summarizes** it using Claude (Anthropic API) in 1–3 sentences
3. **Extracts** the important links
4. **Delivers** a single nightly digest email at the user's preferred time and timezone

The goal is to turn a cluttered inbox into one clean daily briefing.

---

## 2. Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| **Framework** | Next.js 16.1.6 (App Router, Turbopack) | React 19, TypeScript 5 |
| **Styling** | Tailwind CSS 4 + `@tailwindcss/typography` | Prose plugin for rendering email HTML |
| **Auth & Database** | Supabase (Auth + Postgres + RLS) | `@supabase/ssr` for cookie-based sessions |
| **AI Summarization** | Anthropic Claude API (`claude-sonnet-4-5`) | Via `@anthropic-ai/sdk` |
| **Email Inbound** | SendGrid Inbound Parse | Webhook receives forwarded newsletters |
| **Email Outbound** | SendGrid (`@sendgrid/mail`) | Sends nightly digest emails |
| **HTML Sanitization** | `isomorphic-dompurify` | Safe rendering of raw email content |
| **Notifications** | `react-hot-toast` | Toast messages for errors/success |
| **Hosting (planned)** | Vercel | Cron job configured in `vercel.json` |

---

## 3. Current State of the Build

### What's fully built and code-complete

- **Landing page** — Marketing copy, feature highlights, signup/login modals
- **Authentication** — Email/password signup, login, logout, session management via Supabase Auth
- **Profile creation** — Server-side API route using admin client (bypasses RLS safely)
- **Email webhook** — Receives SendGrid Inbound Parse, parses sender/subject/content/links
- **AI summarization** — Synchronous Claude call during webhook processing (avg 3–8s, 15s timeout)
- **Summarization retry** — Separate `/api/summarize` endpoint for failed/pending newsletters
- **Nightly digest cron** — Hourly check, timezone-aware delivery, SendGrid outbound
- **Digest deduplication** — `digest_batches` table with unique constraint prevents double-sends
- **Dashboard** — Stats overview, forwarding address display, first-time onboarding guide
- **Newsletter management** — View sources, block/unblock senders, search
- **Settings** — Edit name, digest time (6 presets), timezone (26 zones), pause/resume digests
- **Archive** — Browse past digests grouped by date, view summaries and links
- **Newsletter detail view** — Full summary, extracted links, sanitized raw HTML content
- **Account deletion** — Cascading delete through admin API
- **Demo mode** — Fully interactive `/demo` page with mock data
- **Rate limiting** — Postgres trigger enforces 50 newsletters per user per 24 hours
- **Row-Level Security** — All tables locked down; users can only access their own data
- **Accessibility** — ARIA labels, live regions, focus trapping in modals, semantic HTML
- **Error pages** — Custom 404 and 500 pages

### What's NOT working yet

**The app cannot be used end-to-end because no external services are connected.** The code is complete, but the infrastructure isn't provisioned.

---

## 4. Problems Holding Us Back from Full Functionality

### Problem 1: No Supabase project exists

**Impact:** Nothing works — no auth, no database, no data storage.

**What's needed:**
1. Create a Supabase project at [supabase.com/dashboard](https://supabase.com/dashboard)
2. Run `supabase/schema.sql` in the SQL Editor to create tables, RLS policies, indexes, triggers, and enums
3. Run migrations `001` and `002` from `supabase/migrations/`
4. Copy these values into a `.env.local` file:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

**Decision needed:** Whether to enable email confirmation in Supabase Auth settings (the app handles both flows).

### Problem 2: No Anthropic API key

**Impact:** Newsletter summarization will fail (status = `'failed'`), but emails will still be received and stored.

**What's needed:**
1. Get an API key from [console.anthropic.com](https://console.anthropic.com)
2. Add to `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

### Problem 3: No SendGrid account configured

**Impact:** Cannot receive inbound emails or send digest emails.

**What's needed:**
1. Create a SendGrid account
2. Set up Inbound Parse to forward emails from `usebrief.me` (or your domain) to:
   `https://yourdomain.com/api/webhooks/email/YOUR_SECRET_TOKEN`
3. Create a SendGrid API key with mail send permissions
4. Add to `.env.local`:

```
SENDGRID_API_KEY=SG...
EMAIL_WEBHOOK_SECRET=your-secret-token
```

### Problem 4: No deployment / domain

**Impact:** SendGrid needs a publicly accessible URL to deliver webhooks. Localhost won't work for receiving real emails.

**What's needed:**
1. Deploy to Vercel (or similar)
2. Point `usebrief.me` DNS to the deployment
3. Configure MX records for SendGrid Inbound Parse
4. Set the cron secret:

```
CRON_SECRET=your-cron-bearer-token
```

### Problem 5: No `.env.local` file exists at all

The repo has no `.env.local` or `.env.example`. Here's the complete template:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic (Claude AI)
ANTHROPIC_API_KEY=

# SendGrid
SENDGRID_API_KEY=

# Secrets
EMAIL_WEBHOOK_SECRET=
CRON_SECRET=

# App
NEXT_PUBLIC_APP_URL=https://usebrief.me
NEXT_PUBLIC_APP_DOMAIN=usebrief.me
```

### Summary: the setup checklist

| Step | Service | Blocks |
|------|---------|--------|
| 1. Create Supabase project + run schema | Supabase | Everything |
| 2. Add Supabase env vars to `.env.local` | — | Auth, data |
| 3. Get Anthropic API key | Anthropic | Summarization |
| 4. Set up SendGrid + Inbound Parse | SendGrid | Email in/out |
| 5. Deploy to Vercel | Vercel | Webhooks, cron |
| 6. Configure DNS (MX + CNAME) | Domain registrar | Email routing |

---

## 5. Lessons Learned

### On architecture decisions that paid off

- **Synchronous summarization in the webhook** eliminated an entire category of state management problems. The row is always in a known state (`pending` → `done` or `failed`), never stuck in limbo. SendGrid's 20-second timeout is generous enough for Claude's 3–8 second response time.

- **`summarization_status` enum instead of nullable `summary`** was a huge clarity win. Previously, a `NULL` summary could mean "not yet processed," "processing right now," or "failed silently." The explicit enum makes the DB self-documenting and the UI straightforward.

- **Database-enforced rate limiting** (Postgres trigger, not app code) means the limit can't be bypassed by bugs in the application layer. Same logic for the `digest_batches` unique constraint preventing double-sends.

- **Admin client without cookies/sessions** (`persistSession: false`) reduced surface area. The service role key doesn't need session machinery — adding it was just unnecessary complexity.

### On problems we hit and solved

- **Signup was broken** because the original approach tried to insert into `profiles` directly from the client, which RLS correctly blocked (no session exists yet during signup). Fix: dedicated `/api/create-profile` route using the admin client.

- **Middleware wasn't running** because the file exported `proxy` instead of `middleware`. Next.js silently ignored it — no error, just no auth protection. Caught during a refactoring pass.

- **Webhook auth had to move from headers to URL path** because SendGrid Inbound Parse can't send custom headers. The original header-based approach was more secure (secrets in headers don't appear in logs), but incompatible with the actual service we're using.

- **Query-param secrets were added then removed.** First we added them as a fallback for SendGrid, then realized URL path segments are better (not logged in query strings). Good example of iterating toward the right answer.

### On process and working with AI

- **The "failed to fetch" error** on signup was simply because the dev server wasn't running. A lot of debugging time can be saved by checking the obvious first.

- **Starting without external services configured** meant we couldn't test any real flows. The code is complete but untestable locally without at minimum a Supabase project.

- **Commit messages told the story.** Each commit documents not just *what* changed but *why* — this made it easy to reconstruct the reasoning behind every decision.

---

## 6. What We Should Do Differently Next Time

### Start with infrastructure, not code

We built an entire application before provisioning a single external service. Next time:

1. **Create the Supabase project first.** Run the schema. Confirm tables exist.
2. **Create `.env.local` with real credentials** before writing any application code.
3. **Verify auth works** (signup → login → session) before building any protected pages.
4. **Set up SendGrid** (even with a test domain) and confirm a webhook can receive a test POST.
5. *Then* build features on top of verified infrastructure.

This inverts the order we followed, but it means every feature can be tested as it's built.

### Create `.env.example` from day one

There should have been an `.env.example` file in the first commit documenting every required variable. Without it, the app looks broken with no clue why.

### Use a tunnel for local webhook testing

Tools like `ngrok` or Vercel's `vercel dev` with preview URLs let you test inbound webhooks locally without deploying. This would have caught the SendGrid header limitation much earlier.

### Test the signup flow immediately

The RLS-blocked signup was the kind of bug that's obvious in 30 seconds of manual testing but invisible in code review. A quick smoke test after the first auth implementation would have saved a commit.

### Keep a running "what's not connected" list

At any point in the build, it should be clear what works locally, what needs a real service, and what's blocked. A simple checklist in the README or a pinned issue would help.

### Simpler first, smarter later

The summarization, link extraction, and digest batching are sophisticated features. But they're useless if you can't sign up. Next time: get the critical path working end-to-end (signup → receive email → show it on dashboard) with the simplest possible implementation, then layer on AI summarization, digest scheduling, etc.

---

## Appendix: File Structure

```
newsletterRollup/
├── app/
│   ├── api/
│   │   ├── create-profile/route.ts       # Profile creation (admin client)
│   │   ├── cron/send-digest/route.ts     # Hourly digest cron job
│   │   ├── delete-account/route.ts       # Account deletion
│   │   ├── summarize/route.ts            # Retry failed summarizations
│   │   └── webhooks/email/[token]/route.ts  # SendGrid inbound webhook
│   ├── dashboard/
│   │   ├── page.tsx                      # Dashboard home
│   │   ├── layout.tsx                    # Auth-protected layout
│   │   ├── newsletters/page.tsx          # Manage sources
│   │   ├── settings/page.tsx             # User preferences
│   │   └── archive/page.tsx              # Past digests
│   ├── newsletters/[id]/page.tsx         # Newsletter detail view
│   ├── demo/page.tsx                     # Interactive demo
│   ├── page.tsx                          # Landing page + auth
│   ├── layout.tsx                        # Root layout
│   ├── error.tsx                         # 500 page
│   └── not-found.tsx                     # 404 page
├── components/
│   ├── CopyButton.tsx
│   ├── DashboardNav.tsx
│   ├── NewsletterContent.tsx
│   ├── NewsletterManagement.tsx
│   └── SettingsForm.tsx
├── lib/
│   ├── formatting.ts                     # Timezones, digest times
│   ├── summarize.ts                      # Claude API integration
│   └── supabase/
│       ├── client.ts                     # Browser client
│       ├── server.ts                     # Server + admin client
│       └── middleware.ts                 # Auth middleware
├── types/database.ts                     # TypeScript interfaces
├── supabase/
│   ├── schema.sql                        # Full database schema
│   └── migrations/
│       ├── 001_add_timezone_and_digest_batches.sql
│       └── 002_add_summarization_status.sql
├── middleware.ts                          # Next.js middleware entry
├── CLAUDE.md                             # Engineering principles
├── package.json
├── vercel.json                           # Cron config
└── tsconfig.json
```

## Appendix: Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase public (anon) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase admin key (server-only) |
| `ANTHROPIC_API_KEY` | Yes | Claude API key for summarization |
| `SENDGRID_API_KEY` | Yes | SendGrid API key for sending digests |
| `EMAIL_WEBHOOK_SECRET` | Yes | Token in webhook URL path for auth |
| `CRON_SECRET` | Yes | Bearer token for cron endpoint auth |
| `NEXT_PUBLIC_APP_URL` | No | App base URL (default: `https://yourdomain.com`) |
| `NEXT_PUBLIC_APP_DOMAIN` | No | Email domain (default: `usebrief.me`) |

## Appendix: Commit History (chronological)

| # | Hash | Summary |
|---|------|---------|
| 1 | `ad9ec26` | Initial project setup — Newsletter Rollup MVP |
| 2 | `73ce69c` | Add interactive demo mode at `/demo` |
| 3 | `54a5939` | Skip Supabase auth for public routes when env vars not set |
| 4 | `56c7086` | Switch email provider from Resend to SendGrid |
| 5 | `3a731da` | Support query param secret for SendGrid Inbound Parse |
| 6 | `afae3aa` | Update domain references to `usebrief.me` |
| 7 | `788b0d0` | Replace personal name with placeholder on public pages |
| 8 | `1a1910c` | Fix signup: use service role API route for profile insert |
| 9 | `08efa0d` | Security, privacy, and UX hardening across signup and digest |
| 10 | `33cc4d4` | Timezone scheduling, rate limiting, privacy disclosure, dedup |
| 11 | `505f3f6` | Apply lessons: honest state, accessibility, simpler architecture |
| 12 | `5587209` | Add CLAUDE.md engineering principles |
| 13 | `795e327` | Refactor: extract shared utilities, fix middleware, tighten cron |
| 14 | `f8bd254` | Fix webhook auth, account deletion, schema sync, branding |
