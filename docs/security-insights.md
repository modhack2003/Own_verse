# Security Insights automation

Uses the official CISA KEV JSON mirror. No AI key, paid scheduler, or publishing approval is needed. Costs remain subject to existing Vercel Functions and database quotas.

- Daily Vercel cron: `/api/cron/security-insights`, `0 5 * * *` (05:00 UTC / approximately 10:30–11:30 IST on Hobby).
- Uses the existing production `CRON_SECRET`; missing or incorrect authorization fails closed. Authentication protects the scheduler and is not a publishing approval.
- First successful run publishes up to eight briefs from the preceding 30 days, distributed across weeks. Existing manual CVE coverage is skipped.
- Subsequent runs publish at most three new briefs per UTC day. Past-month imports also publish automatically. The publishing approval switch has been removed.
- On the first successful sync after this update, existing unpublished imported briefs from the past 90 days publish automatically. Archived posts and manual drafts are excluded. Later syncs preserve editorial changes, including deliberate unpublishing.
- Every successful sync archives blog posts older than 90 days using their publication date, or creation date for drafts without a publication date. Archived content is retained in the database and admin blog list, marked with `archivedAt`, and hidden from the homepage, `/blog`, and individual public post URLs. Nothing is permanently deleted.
- Admin → Blog: daily collection switch, Sync now, Import past month, last success and errors. The manual editor still controls manually authored posts.
- A shared ten-minute MongoDB lease prevents concurrent cron/admin imports. Automatic retries have a twenty-minute cooldown. The endpoint runs for at most five minutes. Paused collection also pauses automatic archiving; Sync now can still run it.
- Stable slugs and a durable CVE ledger prevent duplicates, preserve edits, and keep deleted imported posts from returning.
- Source strings are converted to plain text. The collector has a fixed source URL, no redirect following, a 20-second fetch deadline, an 8 MB body limit and schema validation.
- Briefs attribute CISA, distinguish catalog addition dates from publication dates, explain exploitation/ransomware uncertainty, and keep federal deadlines in context.

## Deployment

Normal GitHub/Vercel deployment generates the Prisma client through the existing postinstall command. New nullable MongoDB fields are backward compatible with documents that omit them. No destructive schema migration is required; do not run `prisma db push --accept-data-loss`.

Daily collection and publishing are enabled by default. Existing pause settings are preserved. The first successful scheduled or manual sync applies the one-time draft migration and 90-day archive policy. Responses include `created`, `published` (existing drafts released), `archived`, `skipped`, and `backfill`; all visibility changes invalidate public pages.

## Verification

Unit tests cover source validation, date windows, budgets, automatic publishing, deletion tracking, lease skips, failures, admin authentication and cron authentication. CI runs `scripts/test-insights.ts` against a disposable MongoDB replica set to verify atomic concurrency, persisted caps, automatic backfill publishing, legacy documents with missing fields, one-time draft release, retained archived content, deletion tracking and editorial preservation. It cannot connect to production.
