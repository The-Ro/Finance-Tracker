# LedgeEaze

A shared personal finance tracker (PWA). Multiple users can see each other's transactions once they approve access to each other; budgets, goals, and personal details stay private per-user.

- **Live:** https://finance-tracker.rohith24112.workers.dev
- **Stack:** React 18 + Vite + TypeScript + Tailwind + TanStack Query + React Router v6 + Recharts + lucide-react + dnd-kit
- **Backend:** Supabase (Postgres, Auth, Storage, RLS) — project id `izidxazhknyoxeqgnqdb`
- **Hosting:** Cloudflare Workers (static assets), deployed via `npx wrangler deploy`
- **Admin:** `rohith24112@gmail.com` is the single hardcoded admin (see Admin pattern below)

## Commands

```bash
npm run dev      # vite dev server, localhost:5173
npm run build    # tsc -b && vite build
npm run lint     # eslint .
npx wrangler deploy   # deploy dist/ to Cloudflare Workers
```

Standard workflow after a batch of changes: `npx tsc -b` (or `npm run build`) → commit → push → `npx wrangler deploy`. There is no CI; deployment is manual.

## Database

- `supabase/schema.sql` — hand-maintained, **append-only** DDL. Represents what a fresh install would run top to bottom. When schema drifts from a migration (see Postgres gotcha below), append a correcting `alter table` block rather than editing the original `create table` in place.
- `supabase/policies.sql` — hand-maintained, the actual RLS source of truth, kept separate from schema.sql.
- Both files must be kept in sync by hand with every migration applied via `mcp__supabase__apply_migration`. There is no automatic schema dump/diff step — if you apply a migration, edit both files in the same batch.
- Every user-owned table has an `owner_user_id uuid references auth.users(id) on delete cascade` column. Deleting an account (`delete_own_account()` RPC) relies entirely on these cascades.

### Known Postgres gotcha: `on delete` clause drift

`categories`, `accounts`, and `tags` each have a `created_by` FK to `auth.users`. The live constraints were found to be missing `on delete set null` even though `schema.sql`'s `create table` statements document it — meaning any account that had ever added its own custom account/category/tag could not delete itself (the `created_by` FK blocked the cascade after every other row had already succeeded, rolling the whole delete back). Fixed via `fix_created_by_fkey_delete_action_drift`. **Lesson:** don't trust `schema.sql` as ground truth for `on delete` behavior — verify live constraint definitions with:
```sql
select conname, conrelid::regclass, pg_get_constraintdef(oid)
from pg_constraint where confrelid = 'auth.users'::regclass and contype = 'f';
```

### RLS / access patterns

- **Admin-by-email**: `auth.jwt() ->> 'email' = 'rohith24112@gmail.com'` directly in RLS policies (no roles table). Mirrored client-side in `src/lib/admin.ts`'s `ADMIN_EMAIL` constant — **the two must be kept in sync by hand**.
- **Narrow SECURITY DEFINER RPCs** (e.g. `mark_feedback_reply_seen`, `delete_own_account`) are used instead of a broad "user can update their own row" policy, specifically to avoid letting a user edit fields they shouldn't (e.g. their own feedback message once an admin has replied to it).
- Postgres grants `EXECUTE` to `PUBLIC` by default on function creation. Every SECURITY DEFINER function not meant to be a public RPC endpoint needs an explicit `revoke execute ... from public` (auth triggers, event triggers, etc.) — several were found publicly callable and locked down this way.
- **Shared-viewer pattern**: `viewer_access` (status = `'approved'`) is joined against in RLS policies to let an approved viewer read another user's transactions/receipts. When adding a new user-owned resource that should be visible to approved viewers (e.g. `documents`, `storage.objects`), mirror `transactions_select_own_or_approved` — remember storage bucket policies are separate from table policies (a document row being readable doesn't mean its file bytes are).

## Date/time handling

**Never use `date.toISOString().slice(0, 10)` to get "today" or a local calendar date.** `toISOString()` converts to UTC first — for any user not in UTC+0 this silently returns yesterday's (or tomorrow's) date depending on time of day and offset direction. This was a real, live bug (`todayISO()` in `src/lib/format.ts`, and `toISODate()` in `src/lib/period.ts`) affecting every default transaction date, every recurring due-date/overdue check, and the dashboard's period-range boundaries for IST users.

Use `toLocalISODate(d: Date)` (in `src/lib/format.ts`) instead — builds the string from the Date object's own local `getFullYear()/getMonth()/getDate()`. `todayISO()` wraps it. If you ever see `.toISOString()` followed by `.slice(0, 10)` anywhere in this codebase, it's almost certainly a bug — the one legitimate exception is `src/lib/recurringDetection.ts`'s `addDays`/`addMonthsPreserveDay`, which construct *and* serialize entirely in UTC space (`Date.UTC(...)` → `.setUTCDate()` → `.toISOString()`), so there's no local/UTC mismatch there.

## Conventions

- **Chart/UI color semantics**: green (`text-positive` / `bg-positive-light`, or `colors.positive` in chart components) = income/credit/balance. Red (`text-red-600`, or `colors.danger` in `getChartTheme()`) = expense/debit/spend. This was unified this way across the dashboard charts and the transactions credit/debit capsule — don't reintroduce the older `text-caution` (amber) styling for expenses in new UI, even though some older per-row transaction styling still uses it.
- **Credit/debit arrow direction is intentionally reversed** from the common convention: down-arrow (`ArrowDownRight`) = credit/money in, up-arrow (`ArrowUpRight`) = debit/money out. User explicitly corrected this from the more common up=in/down=out. See `src/components/transactions/TransactionTable.tsx` / `src/pages/TransactionsPage.tsx`.
- **`formatCompact`** (in `useFormatCurrency()`) gives locale-aware compact currency (`$1.2K`, `₹4.6L`) for glanceable summaries — prefer it over hand-rolled `Intl.NumberFormat` compact formatters.
- **Mutations always call `invalidateQueries`** on success rather than manually patching the query cache — keeps the pattern consistent across ~15 mutation hooks in `src/hooks/`.
- **No cron, no background jobs, no realtime subscriptions anywhere in this app.** Nothing ever advances a recurring item's `next_date` on its own, and nothing pushes cross-user updates into an open tab. Two consequences to remember:
  - Notification-relevant queries that depend on *another user's* action (admin feedback inbox, reply notices, incoming access requests) need `refetchInterval` polling to update without a manual reload — plain `refetchOnWindowFocus` only helps for the same user's own actions across their own tab switches.
  - "Mark as paid" on a recurring/subscription item is the only thing that ever moves its `next_date` forward, and it now also logs a real expense transaction (see `useRecurring.ts`'s `markPaid` mutation) — previously it silently only moved the date.
- **PWA update handling**: `src/components/layout/UpdateBanner.tsx` uses `virtual:pwa-register/react` to poll for a new service worker periodically and show a "new version available" prompt — `registerType: 'autoUpdate'` alone in `vite.config.ts` does not proactively push a new build into an already-open tab (a real problem for a PWA people keep pinned open for days).
- **Recurring/subscription items require an `account`** (added this session — previously optional). A row created before that change can still have `account: null`; UI in `ConfirmedItemRow.tsx` and `OverdueRecurringAlerts.tsx` must handle that gracefully (route to Edit / show "Add account" rather than silently rendering nothing where a "mark as paid" button should be).
- **Custom categories/accounts/tags** are added via Settings → Financial setup (`ManagedListEditor`), not inline from any add-transaction/add-recurring form — there is no inline "+ add new category" affordance anywhere in this app; don't build a picker that filters out anything not in a hardcoded default list without also explicitly re-including anything the user added themselves (this was a real bug: the recurring/subscription category picker's curated relevant-categories filter initially hid custom categories entirely).

## QA / testing pattern

There's a **standing test account** — reuse it instead of creating a new disposable `+qaXX@gmail.com` account for every verification pass:

- Email: `rohith24112+qa15@gmail.com`, password: `QaTest12345!`
- Only create a fresh disposable account when a test specifically needs a brand-new signup flow (onboarding modal, a destructive delete-account test, etc.) — pattern: `rohith24112+qaXX@gmail.com` (increment XX), same password.
- Confirm a fresh signup's email via direct SQL (no email delivery in this environment): `update auth.users set email_confirmed_at = now() where email = '...';`
- **Sign out via the UI before SQL-deleting a disposable account.** Deleting `auth.users` out from under a still-open authenticated session causes a stale-JWT retry storm in that tab.
- **Never use the real admin account (`rohith24112@gmail.com`) for anything mutating/destructive.** This session accidentally landed on it twice via a stale local session in the dev browser tab — always check the avatar/email in the top-right before running any test action, and sign out immediately (no data touched) if it's not the QA account.
- The dev tab's browser viewport size fluctuates unpredictably in this environment (observed anywhere from ~280px to ~800px wide across otherwise-identical calls) — re-screenshot immediately before clicking a coordinate rather than reusing coordinates from an earlier screenshot in the same flow.

## App icon / branding

`public/icons/icon-source.svg` and `icon-maskable-source.svg` are the editable SVG sources for the app icon (purple `#6558D3` background — the app's default "violet" accent, `ACCENT_HEX.violet` in `src/lib/themeColors.ts` — card outline + "Rs" monogram in cream/gold). The actual served files (`favicon.png`, `icons/icon-192.png`, `icons/icon-512.png`, `icons/apple-touch-icon-180.png`, `icons/maskable-512.png`) are rasterized PNGs generated from those sources — regenerate by rendering the SVG onto an HTML canvas (e.g. via the browser) and exporting `toDataURL('image/png')` at each required size; there's no image-processing package installed in this repo. `maskable-512.png` currently reuses the plain icon-512 render rather than a properly inset safe-zone version — revisit if Android home-screen icon cropping looks wrong.

## Versioning

`package.json`'s `version` and `src/lib/whatsNew.ts`'s `APP_VERSION` are kept in sync by hand (no automated bump). `WHATS_NEW_ITEMS` is a flat list of the *current* release's highlights (replaced wholesale each release, not accumulated) — bump `CURRENT_WHATS_NEW_VERSION` (a date string) alongside it whenever you update the list, since that's what gates the auto-shown "What's new" modal (`WhatsNewModal.tsx`) for users who haven't seen the current version yet.
