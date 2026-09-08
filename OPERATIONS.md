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

Run `npm run build` before every deploy, not just `vite build` — it's the only thing that
type-checks the whole project; `vite build` alone will happily ship a type error.

## Database changes

`supabase/schema.sql` and `supabase/policies.sql` are the source of truth, kept in the repo
so the live schema is reviewable in a diff — **but they're append-only logs of every
migration ever applied, not a clean "current state" dump.** A fresh column shows up as an
`alter table ... add column if not exists ...` appended near the bottom, not folded into the
original `create table`. When changing the schema:

1. Apply the change directly against the Supabase project (SQL editor, or the Supabase MCP
   tools if you're working with an AI agent that has them).
2. Append the equivalent SQL to `schema.sql` (structure) or `policies.sql` (RLS policies —
   **not** the same file; `schema.sql` contains zero `create policy` statements by design).
3. Update `src/types/database.types.ts` by hand to match (see ARCHITECTURE.md — it's not
   generated). TypeScript will not catch a mismatch here on its own.
4. If the change touches RLS, re-run the security advisor (below) before considering it done.

There's no separate migrations-tracking table or CLI migration workflow in this project —
`schema.sql`/`policies.sql` *are* the migration history, applied by hand.

## Deployment

Currently deployed as static assets via Cloudflare Workers (`wrangler.jsonc` — SPA fallback
configured, so client-side routing works on a hard refresh of any path):

```bash
npm run build
npx wrangler deploy
```

`wrangler` is not currently a pinned `devDependency` — `npx wrangler` fetches whatever the
latest version is at deploy time. For anything beyond solo/occasional deploys, pin it
(`npm install -D wrangler`) and add an npm script (`"deploy": "vite build && wrangler
deploy"`) so the deploy command and its version are both reproducible and reviewable in
`package.json`, rather than living only in a person's memory or shell history.

There's no CI/CD pipeline (no `.github/workflows`) — every deploy today is a manual
`npm run build && npx wrangler deploy` from someone's machine. Fine at this scale; worth
automating (build + deploy on push to `main`) once more than one person ships changes.

**PWA rollout behavior**: the service worker precaches the whole app (`generateSW`,
`registerType: 'autoUpdate'`). A deploy is immediately live for anyone opening the app fresh;
someone with it already open (or installed to a home screen) gets the new version on their
*next* full reload, not instantly and not mid-session. There is no way to force-push an
update to already-open clients — don't rely on a deploy fixing something for users who are
already mid-use.

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
  than a human running `npm run build` first.
- **`wrangler` unpinned** (see Deployment above).

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
