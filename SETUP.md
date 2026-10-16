# Setup

## 1. Environment
Copy `.env.example` to `.env` and fill it in (on Vercel: *Settings → Environment Variables*).

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | MongoDB Atlas URI **including the database name** (`…mongodb.net/portfolio?…`). URL-encode special characters in the password (`@` → `%40`). |
| `ADMIN_PIN` | yes (first login) | 6–12 digits. After logging in, change it in **Admin → Security** — the new PIN is stored hashed in MongoDB and `ADMIN_PIN` stops working. |
| `GITHUB_TOKEN` | no | Read-only token; raises GitHub's rate limit for the sync. |
| `CRON_SECRET` | for scheduled sync | Random production secret authenticating the daily GitHub refresh. |
| `GITHUB_USERNAME` | no | Fallback if the profile has no GitHub URL (default `modhack2003`). |
| `BLOB_READ_WRITE_TOKEN` | no | Only for uploading a resume PDF (Vercel Blob). You can paste a resume link instead. |

## 2. Install & database
```bash
npm install
npm run db:push        # creates the new collections + unique indexes (safe, keeps data)
npm run prisma:seed    # sample data — skipped automatically if the DB already has a profile
npm run dev            # http://localhost:9002
```

## 3. Admin console
1. Go to `/b1kr4m-5h4d0w` and solve the puzzle (or open `/bikram` directly).
2. Enter the PIN. 5 wrong attempts lock that IP for 15 minutes; every attempt is logged.
3. Sessions last 12 h (2 h idle) and survive reloads. Log out, "sign out other devices" and the login history are in **Security**.

`/admin` is a decoy that never logs in.

**Forgot the PIN?** Delete the document in the `AdminCredential` collection (Atlas → Browse Collections); login falls back to `ADMIN_PIN`.

## 4. Content
- **GitHub → Sync now** pulls your avatar, location and every public repo. New repos (not forks/archived) are shown automatically; toggle, pin or rename them in the same tab. Repos without a description use the first paragraph of their README. The site shows every pinned repo plus the 5 latest unpinned repos, with a "show all" button. Hidden repos remain hidden across syncs. Opening the GitHub admin tab refreshes data older than six hours; `vercel.json` also schedules a daily production refresh at 04:00 UTC (Vercel timing can vary). Set `CRON_SECRET` in production before deploying. Syncs share a database lease and preserve custom repo settings; automatic runs do not overwrite profile fields.
  CLI alternative: `npm run github:sync`.
- **LinkedIn import:** LinkedIn blocks automated reads, so request your data export (*Settings & Privacy → Data privacy → Get a copy of your data*) and drop the `.zip` in **Admin → LinkedIn import**. It previews first; nothing is saved until you press *Import now*. Imports profile headline/summary, experience, education, certifications, projects and skills.
- **Inbox:** contact-form messages are stored in MongoDB (rate-limited, with a honeypot).
- **Blog:** write posts in Markdown; only published posts appear, at `/blog/<slug>`.
- **Bug bounty:** add findings in **Admin → Bug bounty**. Tick *Private program* to hide the program name and link on the site (they are removed on the server, not just hidden). The Hall of Fame section appears once there is at least one finding. Add your HackerOne / Bugcrowd / … profile links in **Profile**, one per line.
- **Requests:** VAPT requests and bug bounty program invites arrive in **Admin → Requests** with a reference code (`VAPT-…` / `BB-…`). Set a status, keep private notes and reply by email. The tab shows a badge with the number of new requests.

Every save refreshes the public pages immediately; otherwise they re-render at most once a minute.

## Tests
```bash
npm test            # unit tests
npm run typecheck
npm run lint
```

## Content availability and recovery

Builds now require a reachable, populated database to avoid releasing an empty portfolio. See [portfolio improvements](docs/portfolio-improvements.md) for the content check, schema/index setup, admin Trash/history, backup limits, and browser tests.
