# Portfolio backlog: selected October improvements

Implements issue #20 items 1, 2, 4–10. The Naruto/cyber design remains. Authentication changes and portfolio case-study content are separate work.

## Publishing and availability

- The 90-day archive job targets only slugs in the durable Security Insights import ledger. Original write-ups, including older posts discussing CVEs, are preserved. Imported content is archived reversibly.
- `npm run build` first runs `content:check`. A working database, a populated public profile (name/title/bio), and at least one visible project/repository are required. A connection failure or incomplete source data fails the release; Vercel keeps the previous successful deployment. No demo data is inserted by this check.
- Home-page database errors now fail static generation/revalidation rather than silently generating an empty portfolio. Runtime ISR can retain its last successful page. This protects releases; it does not make dynamic pages available during a database outage.
- The blog reads 12 summaries per page, never whole article bodies in listing queries. Search matches titles/excerpts case-insensitively; tag filtering matches an exact tag. GET forms and pagination URLs preserve filters and work without client-side JavaScript.

## Accessibility and mobile projects

The entrance dialog is static and defaults to safe mode before paint. It has no loading delay or flicker. Keyboard focus starts on Safe Mode, remains in the dialog, and moves to the page's main content on dismissal. Escape selects safe mode. Reduced-motion preferences override a stored glitch choice and update when the OS setting changes. Storage-denied browsing still works.

Shared reveals, text decoding, parallax and tilt honor the same mode; existing WebGL viewport pausing and reduced-motion fallbacks remain. Mobile grid and list cards expose Source/Visit, Demo (when present), and Details links as siblings of selection buttons, without nesting interactive elements. Keyboard selection updates the preview too.

## Search discovery and fonts

- Canonical URLs use the public production origin. Home-page Person and article BlogPosting JSON-LD escape content-controlled markup. Articles include publication/modification metadata and a social image.
- `/sitemap.xml` includes only public pages/published articles. `/robots.txt` and noindex headers exclude API/admin/decoy paths. Filtered searches are noindex, follow.
- The four existing font families remain. Requested weights drop from 15 to 9; Japanese UI labels use a 106-glyph subset. When adding Japanese labels, extend the `text=` subset in layout.tsx. Google Fonts still uses `display=swap` and preconnects.
- `scripts/measure-mobile.cjs` records LCP, CLS, observed long-task blocking, TTFB, font bytes, page errors and overflow using Chromium Pixel 7 emulation, 4× CPU slowdown, 1.6 Mbps download and 150 ms latency. Results are laboratory measurements against synthetic local data, not real-user Core Web Vitals or a production speed guarantee.

## Admin history, Trash and backups

Open **History & recovery** in the real admin console. New writes to profile, projects, skills, certificates, education, experience, CTFs, GitHub repositories, blog, bounty findings and audio settings store full before/after revisions in the same Mongo transaction as the content edit. Automatic content syncs are recorded too. Existing records have no historical revisions until their next write. Actor labels are session-token hash prefixes or `automation`; raw session tokens are never logged.

Deleting these content records sets optional `deletedAt`; normal reads/counts exclude both newly deleted records and retain compatibility with older Mongo documents that omit the field. Trash shows retained records by collection. Review a revision, compare current/before/after, and explicitly restore a side. If the record changed since review, restoration fails with 409. Every restore creates a new undo revision; conflicting writes or a failed audit insert roll back the transaction.

The **Download content backup** action exports the 11 content collections (including drafts/Trash/private bounty details) plus the import deduplication ledger. The upload path validates the entire file in a dry run before enabling restore. Restore merges by durable ID, keeps records absent from the file, rejects unique-field/singleton conflicts and records every overwrite. It is atomic; it never partially restores a file.

Limits: 3 MB / 1,000 records per content backup. Credentials, sessions, login attempts, inbox messages, client requests and old revision history are excluded. Uploaded photos/resumes are URL references, not copied media binaries. Keep downloaded files private. Use the database provider's separate backups and media retention for full disaster recovery or larger datasets. Content history itself is retained without automatic pruning.

Schema changes: optional `deletedAt` on the 11 content models and a new `ContentRevision` collection with indexes. Run the normal `npx prisma db push` deployment/schema setup to create its indexes; existing content fields need no data rewrite. Prisma generation remains the existing install step.

## Reproduce verification

The integration scripts refuse any URL except their exact localhost disposable database. They never fall back to `DATABASE_URL`.

1. Start a local MongoDB 7 replica set on port 27017 named `rs0`.
2. `npm ci`; `npm run typecheck`; `npm run lint`; `npm test -- --runInBand`.
3. Set `RECOVERY_TEST_DATABASE_URL=mongodb://127.0.0.1:27017/studio_recovery_test?replicaSet=rs0`; run `npm run test:recovery`.
4. Set `INSIGHTS_TEST_DATABASE_URL=mongodb://127.0.0.1:27017/studio_insights_test?replicaSet=rs0`; run `npx tsx scripts/test-insights.ts`.
5. Set `E2E_DATABASE_URL=mongodb://127.0.0.1:27017/studio_e2e_test?replicaSet=rs0`; run `npx tsx scripts/seed-e2e.ts`.
6. Set `DATABASE_URL` to that same e2e database; run `npx prisma db push --skip-generate` and `npm run build`.
7. `npx playwright install --with-deps chromium`; `npm run test:e2e`. The runner starts the production server, uses a fixture PIN, and tests desktop/mobile against real APIs and Mongo. Each browser project resets only synthetic test data, preserving indexes. Screenshots/traces are retained on failure.
8. To measure mobile performance, start the production server on port 3100 with the e2e database and run `node scripts/measure-mobile.cjs`. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select an already installed Chromium.

CI performs the database integrations and all 12 browser scenarios. Missing-database release refusal is checked explicitly. CI stores browser failure artifacts for seven days.
