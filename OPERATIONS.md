# Operations

Practical runbook for running, deploying, and maintaining LedgeEaze. For how the pieces fit
together, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Local development

```bash
npm install
cp .env.example .env.local   # fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev
```

`npm run dev` also serves on your LAN (`http://<your-IP>:5173`) so you can test on a phone
without deploying anything — see the README for the "Add to Home Screen" steps.

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server, HMR |
| `npm run build` | `tsc -b && vite build` — type-checks, then emits `dist/` |
| `npm run preview` | Serves the built `dist/` locally, for a final check before deploying |
| `npm run lint` | ESLint |
| `npm test` | Runs the Vitest unit suite once |
| `npm run test:watch` | Runs Vitest in watch mode while developing |
| `npm run check` | Runs linting, tests, type-checking, and the production build |

Run `npm run check` before every deploy. It runs linting and tests as well as `npm run build`;
the build performs the full TypeScript check before emitting `dist/`. `vite build` alone will
happily ship a type error.

## Database changes

`supabase/schema.sql` and `supabase/policies.sql` are the source of truth, kept in the repo
so the live schema is reviewable in a diff — **but they're append-only logs of every
migration ever applied, not a clean "current state" dump.** A fresh column shows up as an
`alter table ... add column if not exists ...` appended near the bottom, not folded into the
original `create table`. When changing the schema:

1. Write the change as a re-runnable file in `supabase/migrations/<YYYY-MM-DD>_<name>.sql`
   (`create or replace`, `drop ... if exists`, `add column if not exists`), so running it twice
   is harmless.
2. Apply it against the Supabase project (SQL editor, or the Supabase MCP tools if you're
   working with an AI agent that has them).
3. Append the equivalent SQL to `schema.sql` (structure) or `policies.sql` (RLS policies —
   **not** the same file; `schema.sql` contains zero `create policy` statements by design).
4. Update `src/types/database.types.ts` by hand to match (see ARCHITECTURE.md — it's not
   generated). TypeScript will not catch a mismatch here on its own.
5. Run `supabase/tests/security_regression.sql` in the SQL editor and expect a single
   `ALL SECURITY CHECKS PASSED` row; if the change touches RLS, also re-run the security
   advisor (below).

There's no migrations-tracking table or CLI workflow: the files in `supabase/migrations/` are
a record of what was applied by hand, and `schema.sql`/`policies.sql` are the full history.

### Releasing 1.7.0 (pending as of 2026-09-27)

Three migrations ship with 1.7.0, and the app and database depend on each other, so do these
back to back, in this order. They build on 1.6.0's closed accounts (`accounts.closed_at`,
`set_account_closed`); the account-types migration adds the column if it's missing and
re-creates `set_account_closed` with a locked-down search path, so no separate step is needed.
It also gives every user an open `Cash` account if they don't have one, and from then on
the last cash account can't be deleted, closed or retyped ("Cash is always kept").

1. Run `supabase/migrations/2026-09-27_security_bug_sweep.sql`.
2. Run `supabase/migrations/2026-09-27_account_types_debit_cards.sql`.
3. `npm run deploy` straight away (between steps 1 and 3 the old app can't send sharing
   requests; between 2 and 3 it still shows "Bank" account types).
4. Run `supabase/migrations/2026-09-27_fingerprint_includes_type.sql`.
5. Run `supabase/tests/security_regression.sql` → `ALL SECURITY CHECKS PASSED`.

Afterwards, check for leftover fake debit-card accounts (old accounts named like
"… Debit Card", which an earlier name rule typed as credit cards). Settings → Accounts & cards
offers "Convert to a debit card" for each one, or list them with:
`select owner_user_id, name, kind from accounts where name ilike '%debit%';`

## Deployment

Currently deployed as static assets via Cloudflare Workers (`wrangler.jsonc` — SPA fallback
configured, so client-side routing works on a hard refresh of any path):

```bash
npm run deploy   # runs check (lint+test+build), then wrangler deploy
```

`wrangler` is a pinned `devDependency` (exact version, no `^` range) so `npx wrangler` /
`npm run deploy` always resolve to the same locally-installed version instead of `npx`
fetching whatever's latest at deploy time — bump it deliberately (`npm install -D
wrangler@<version>`) when there's a reason to, not silently on every deploy.

`.github/workflows/ci.yml` runs `npm run check` (lint + test + build) on every push and PR
against `main` — this only *validates*, it does not deploy. Deploying is still a manual
`npm run deploy` from someone's machine. Worth automating the deploy step too (on push to
`main`, after CI passes) once more than one person ships changes and a human running it by
hand becomes the actual bottleneck rather than a deliberate checkpoint.

**PWA rollout behavior**: the service worker precaches the whole app (`generateSW`,
`registerType: 'prompt'`). A deploy is immediately live for anyone opening the app fresh.
Someone with it already open (or installed to a home screen) sees a "new version available"
banner within about an hour (`UpdateBanner` polls) and gets the new version when they tap
it — never an automatic reload mid-typing. Tabs still running a build from before this
setting changed won't show the banner once; they update after all tabs are closed. There is
no way to force an update on already-open clients — don't rely on a deploy fixing something
for users who are mid-use.

**Versioning**: `package.json`'s `version` and `src/lib/whatsNew.ts`'s `APP_VERSION` /
`CURRENT_WHATS_NEW_VERSION` are bumped together by hand whenever a user-facing batch of
changes ships — bumping `CURRENT_WHATS_NEW_VERSION` is what makes the "What's new" modal
resurface for users who already dismissed the last one.

## Monitoring & logs

- **Client crashes**: `public.client_errors` (message, stack, URL, user agent, user id if
  signed in) — insert-only from the client, no select policy, so read it via the Supabase
  SQL editor: `select * from client_errors order by created_at desc limit 50;`. There's no
  alerting on this table — it's a "go look when something's reported" log, not a paged one.
- **API/DB/Auth logs**: Supabase provides these automatically per-project (Dashboard → Logs).
  Nothing to configure; retention depends on your Supabase plan.
- **Security/performance advisors**: Supabase's built-in linter. Worth re-running after any
  schema or RLS change:
  - Security: checks for RLS gaps, `SECURITY DEFINER` functions with unintended public
    `EXECUTE`, leaked-password-protection status, etc.
  - Performance: unindexed foreign keys, etc. (mostly informational at this app's data volume)

  Via the Supabase MCP tools: `get_advisors` with `type: "security"` / `type: "performance"`.
  Via the dashboard: Database → Advisors.

## Known operational gaps (as of this writing)

- **Leaked-password protection is off** in Supabase Auth (checks new passwords against
  HaveIBeenPwned). It's a dashboard toggle (Authentication → Policies), not something
  scriptable via SQL/migration — turn it on there.
- **No automated backups configured beyond Supabase's own plan-level backups.** Know what
  your current Supabase plan actually gives you (point-in-time recovery vs. daily snapshot
  vs. nothing) rather than assuming — check Database → Backups in the dashboard.
- **No CI.** Nothing currently blocks a broken build/type error from being deployed other
  than a human running `npm run check` first.

## Environment / secrets

- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are the only two env vars, and both are
  meant to be public — they ship in the client bundle by design (see `.env.example`). RLS is
  the actual security boundary; there is no server-side secret to protect in this
  architecture (no service-role key is ever used from the client or committed anywhere).
- `.env.local` is gitignored. Never commit real values to `.env.example` — it should only
  ever contain placeholders.

## Deleting a user's data

`delete_own_account()` (called via the Danger Zone in Settings) is the supported path — it
deletes the `auth.users` row, and every table's `owner_user_id` foreign key is
`on delete cascade`, so it takes that user's entire footprint with it in one transaction.
There is no separate manual-deletion runbook needed; don't hand-delete rows across tables —
use this RPC (or delete the `auth.users` row directly with the same cascade effect) so
nothing is missed.
