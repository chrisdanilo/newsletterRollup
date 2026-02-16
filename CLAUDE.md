# NewsletterRollup — Engineering Principles

Every decision on this project — frontend, backend, database, infrastructure, UX copy — should be evaluated against these four questions, in order:

1. **Does it make the tool easier to use?**
   Users should never have to think about how the tool works. Onboarding should be self-explanatory. Errors should tell users what to do next, not what went wrong internally. The happy path should be frictionless.

2. **Does it make it more secure?**
   Prefer eliminating attack surface over defending it. Secrets belong in headers, not URLs. Validation belongs at the boundary. Privileges should be as narrow as possible (the admin client bypasses RLS — use it only when unavoidable). When in doubt, reject and log rather than accept and hope.

3. **Does it make it more private?**
   Users trust us with their email content. That content goes to Supabase and to Anthropic for summarization — no further. We never sell or share data. Privacy disclosures should be honest and specific, not buried in legalese. Data that's no longer needed should be deleted.

4. **Does it make it simpler?**
   Prefer a system that is always in a known, observable state over one that handles failures gracefully. Prefer synchronous over async when the latency is acceptable. Prefer explicit status columns over nullable fields with multiple meanings. Every piece of infrastructure (cron jobs, queues, background workers) is a failure mode — eliminate them when possible rather than managing them.

## When these principles conflict

Simplicity usually serves all three others. A simpler system is easier to use, easier to audit for security issues, and exposes less data to more places.

If usability and privacy conflict (e.g. "we could improve summaries by retaining more content") — **privacy wins**.

If security and simplicity conflict (e.g. "this extra validation step is annoying") — **security wins**.

## Applied examples from this codebase

| Decision | Principle |
|---|---|
| Summarization runs synchronously in the webhook | Simpler — row is always in a known state |
| `summarization_status` enum instead of nullable `summary` | Simpler — no ambiguous nulls |
| `createAdminClient()` uses no cookies or sessions | Simpler + Secure — no unnecessary surface area |
| Secrets accepted in headers only, never query params | Secure — query strings appear in logs |
| `digest_batches` unique constraint prevents double-sends | Simpler — DB rejects duplicates atomically |
| Privacy disclosure on signup form and in every digest email | Private — users know what happens to their data |
| Browser timezone auto-detected on settings page | Easier to use — no manual setup |
| First-time dashboard shows step-by-step guide | Easier to use — users know what to do next |
| DB trigger enforces rate limit (50 newsletters/24h) | Secure + Simple — enforced at storage layer |
