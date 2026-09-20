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
npm run test     # vitest run (src/lib/*.test.ts — pure-function unit tests only, no component/integration tests yet)
npm run check    # lint && test && build, in that order
npx wrangler deploy   # deploy dist/ to Cloudflare Workers
```

Standard workflow after a batch of changes: `npm run check` (or at minimum `npx tsc -b`) → commit → push → `npx wrangler deploy`. There is no CI; deployment is manual.

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

- **Chart/UI color semantics**: green (`text-positive` / `bg-positive-light`, or `colors.positive` in chart components) = income/credit/balance. Red = expense/debit/spend — in chart code this is still the hardcoded `colors.danger` inside `getChartTheme()` (deliberately independent of the user's accent theme, untouched), but everywhere else use the `--danger`/`--danger-light` tokens (`text-danger`, `bg-danger-light` — see Design system below) instead of hardcoding `red-600`/`red-50`. This was unified this way across the dashboard charts and the transactions credit/debit capsule — don't reintroduce the older `text-caution` (amber) styling for expenses in new UI, even though some older per-row transaction styling still uses it.
- **Credit/debit arrow direction is intentionally reversed** from the common convention: down-arrow (`ArrowDownRight`) = credit/money in, up-arrow (`ArrowUpRight`) = debit/money out. User explicitly corrected this from the more common up=in/down=out. See `src/components/transactions/TransactionTable.tsx` / `src/pages/TransactionsPage.tsx`.
- **`formatCompact`** (in `useFormatCurrency()`) gives locale-aware compact currency (`$1.2K`, `₹4.6L`) for glanceable summaries — prefer it over hand-rolled `Intl.NumberFormat` compact formatters.
- **Mutations always call `invalidateQueries`** on success rather than manually patching the query cache — keeps the pattern consistent across ~15 mutation hooks in `src/hooks/`.
- **No cron, no background jobs, no realtime subscriptions anywhere in this app.** Nothing ever advances a recurring item's `next_date` on its own, and nothing pushes cross-user updates into an open tab. Two consequences to remember:
  - Notification-relevant queries that depend on *another user's* action (admin feedback inbox, reply notices, incoming access requests) need `refetchInterval` polling to update without a manual reload — plain `refetchOnWindowFocus` only helps for the same user's own actions across their own tab switches.
  - "Mark as paid" on a recurring/subscription item is the only thing that ever moves its `next_date` forward, and it now also logs a real expense transaction (see `useRecurring.ts`'s `markPaid` mutation) — previously it silently only moved the date.
- **PWA update handling**: `src/components/layout/UpdateBanner.tsx` uses `virtual:pwa-register/react` to poll for a new service worker periodically and show a "new version available" prompt — `registerType: 'autoUpdate'` alone in `vite.config.ts` does not proactively push a new build into an already-open tab (a real problem for a PWA people keep pinned open for days).
- **Recurring/subscription items require an `account`** (added this session — previously optional). A row created before that change can still have `account: null`; UI in `ConfirmedItemRow.tsx` and `OverdueRecurringAlerts.tsx` must handle that gracefully (route to Edit / show "Add account" rather than silently rendering nothing where a "mark as paid" button should be).
- **Custom categories/accounts/tags** are added via Settings → Financial setup (`ManagedListEditor`), not inline from any add-transaction/add-recurring form — there is no inline "+ add new category" affordance anywhere in this app; don't build a picker that filters out anything not in a hardcoded default list without also explicitly re-including anything the user added themselves (this was a real bug: the recurring/subscription category picker's curated relevant-categories filter initially hid custom categories entirely).

## Design system & theming

- **Accent theme presets** live in three places that must be kept in sync by hand: `ACCENT_HEX` in `src/lib/themeColors.ts`, the `ThemeAccent` union in `src/types/database.types.ts`, and the `ACCENTS` array in `src/components/settings/ThemeSettings.tsx` (plus a separate `'custom'` hex-picker path that isn't a preset). Presets: `oxblood` (current default, listed first), `violet` (original default), `ocean`, `sunset`, `pink`, `green`, `sage`, `mauve`, `plum`, `crimson`, `charcoal`. This is a genuine per-user product feature — never hardcode one color over it.
- **`oxblood` (`#5C1B2E`) is the current default**: new signups get it (`supabase/schema.sql`'s `theme_accent` column default + check constraint), and it's the pre-auth/unauthenticated fallback (`index.html`'s inline pre-mount script and `theme-color` meta, `vite.config.ts`'s PWA `manifest.theme_color`). It does **not** retroactively override any existing user's already-saved `theme_accent` — check `ThemeContext.tsx`'s fallback values if you touch this.
- **`--danger` / `--danger-light`** CSS custom properties (`src/index.css`, wired into `tailwind.config.ts` the same way as `positive`/`caution`/`info`) close a gap where every error/destructive tone used to hardcode `red-600`/`red-50`. Prefer `text-danger`/`bg-danger-light` in new UI.
- **`PageHeader`** (`src/components/ui/PageHeader.tsx`) is the shared `{ title, actions? }` page-header component (serif `text-2xl font-semibold` title) — used by Dashboard, Transactions, Budgets, Goals, Rules, Documents, and `RecurringLikePage` (shared by Recurring + Subscriptions). Use it for any new top-level page instead of hand-rolling the `<h1>` + actions-row markup.
- **`AuthLayout`'s `split` prop** (`src/components/auth/AuthLayout.tsx`) renders the split-screen layout — an accent-tinted brand panel with `BrandHeader` + headline/supporting text on the left (`hidden lg:flex`), collapsing to a single centered `<Card>` below `lg` — used by all four auth pages (Login/Signup/Forgot/Reset).
- **Motion system already exists** in `src/index.css` — `.animate-fade-in`, `.animate-scale-in`, `.animate-fade-in-up`, `.animate-pop-in`, `.animate-shadow-breathe`, `.animate-shake`, `.animate-toast-in`/`-out`, `.skeleton` shimmer (with a `prefers-reduced-motion` fallback), `.card-interactive` (hover lift + shadow + border, active press) — all on `cubic-bezier(0.16, 1, 0.3, 1)`. Reuse these classes; don't add a parallel animation system.
- **Every dark-mode `.dark[data-accent='X']` block needs an `--accent-dark` override, not just `--accent-light`.** `--accent-light` is a tinted background (pills, badges, active-nav, banners — `Pill.tsx`, `Avatar.tsx`, `Sidebar.tsx`, `RecurringLikePage.tsx`'s banner), `--accent-dark` is the text/icon color drawn on top of it. Each preset darkens `--accent-light` for dark mode, but until this was fixed no preset gave `--accent-dark` a matching dark-mode value — it stayed pinned to its light-mode shade (tuned for a near-white background), which converges to nearly the same color as the new dark `--accent-light` and makes the pairing unreadable. `charcoal` had it worst (no hue to fall back on at all — its dark-mode `--accent-light` is now kept *light*, like light mode, instead of darkened) but every preset had some version of this; each now gets a brightened `--accent-dark` for dark mode alongside its `--accent-light` override.
- **`Card` (`src/components/ui/Card.tsx`) omits its own `bg-app-card`/`border-app-border` defaults when the caller's `className` supplies a `bg-`/border-color override** (e.g. `bg-accent-light`, `bg-red-50/40`). Tailwind emits same-property utilities in a fixed internal order (alphabetical-ish by class name, not by `tailwind.config.ts` key order or by position in `className`), so `bg-app-card` was winning over a caller's `bg-accent-light` in the generated stylesheet regardless of source order — Card's own background silently beat every attempt to tint it. Any future "same CSS property, two classes on one element" pattern needs the same treatment (omit-the-default, not reorder-the-config — reordering `tailwind.config.ts`'s color keys does not change generation order).

## QA / testing pattern

There's a **standing test account** — reuse it instead of creating a new disposable `+qaXX@gmail.com` account for every verification pass:

- Email: `rohith24112+qa15@gmail.com`, password: `QaTest12345!`
- Only create a fresh disposable account when a test specifically needs a brand-new signup flow (onboarding modal, a destructive delete-account test, etc.) — pattern: `rohith24112+qaXX@gmail.com` (increment XX), same password.
- Confirm a fresh signup's email via direct SQL (no email delivery in this environment): `update auth.users set email_confirmed_at = now() where email = '...';`
- **Sign out via the UI before SQL-deleting a disposable account.** Deleting `auth.users` out from under a still-open authenticated session causes a stale-JWT retry storm in that tab.
- **Never use the real admin account (`rohith24112@gmail.com`) for anything mutating/destructive.** This session accidentally landed on it twice via a stale local session in the dev browser tab — always check the avatar/email in the top-right before running any test action, and sign out immediately (no data touched) if it's not the QA account.
- The dev tab's browser viewport size fluctuates unpredictably in this environment (observed anywhere from ~280px to ~800px wide across otherwise-identical calls) — re-screenshot immediately before clicking a coordinate rather than reusing coordinates from an earlier screenshot in the same flow.

## App icon / branding

**`logo/logo.png`** (1536×1024, tracked in git, deliberately **outside** `public/` so its 2.5MB doesn't ship in the deployed bundle or get PWA-precached) is the master art the user supplied for the wallet+card+"Rs" mark, and is the actual source of truth — **the user has explicitly said to follow it strictly, no redesigning it.**

Both the served icons and the in-app logo are now generated from `logo/logo.png` by color-key extraction — pixel-perfect, no hand-tracing anywhere in the pipeline (an earlier hand-vectorized SVG approximation, `WalletMark()` drawing its own `<path>`/`<rect>`/`<text>` elements, was tried and explicitly rejected by the user in favor of exact fidelity to the source file — don't reintroduce it). `logo.png` has no real alpha channel (the "transparency" checkerboard is baked in as opaque near-gray pixels, R≈G≈B); a pixel counts as mark if `(r-g)>25 && (r-b)>15 && r<200`.

**Served icons** (`favicon.png`, `icons/icon-192.png`, `icons/icon-512.png`, `icons/apple-touch-icon-180.png`, `icons/maskable-512.png`): matched pixels recolored to `#5C1B2E` at full alpha, everything else to alpha 0, composited onto a transparent canvas of the target size (no background fill — user's explicit "no yellow bg" call) with the mark centered on its bbox (`x:[221,1314] y:[206,870]` in the 1536×1024 source, center `(767.5, 538)`) — regular icons at 74% of canvas width, `maskable-512.png` at 56% (extra margin for Android's safe-zone cropping).

**In-app logo** (`WalletMark()` in `src/components/ui/BrandHeader.tsx`, used on the auth pages and the post-login header/menu): a *different* extraction, `public/icons/wallet-mark.png` — tightly cropped to the mark's own bbox with no padding, scaled to 480px wide (480×292, preserving the mark's true ~1.64:1 aspect ratio) — rendered as a `<div>` with `mask-image`/`-webkit-mask-image` set to that PNG and `background-color` left to the `bg-accent-dark` Tailwind class. This is what makes it recolor per accent theme and light/dark mode the same way the old currentColor SVG did, while still being the user's exact pixel shape — CSS masks use the source image only as an alpha stencil, so the fill color comes from the element's own background, not from the PNG's own (fixed) color. The container is sized `h-9 w-auto` with `aspect-ratio: 480 / 292` inline (not a fixed square) to match the mask's real proportions — don't force it back into a square box, that's what caused the old hand-drawn version to look letterboxed/off.

Both extractions read `x:[221,1314] y:[206,870]` as the mark's bbox in the 1536×1024 source — reuse that constant rather than re-deriving it if the master art doesn't change.

There's no image-processing package in this repo, so the color-key/composite step above happens on an HTML `<canvas>` in the browser. Navigate to the app's actual HTML root (`http://localhost:5173/`) first — never straight to a raw file URL, or `canvas.getContext` won't exist — and don't rely on the Browser pane's "fronted tab" default if other tabs were opened on raw SVG/file URLs earlier in the session (`javascript_exec` runs against whichever tab is fronted — pass `tabId` explicitly or `tabs_select` first, or you'll silently execute against a stale tab). Note: a transparent `apple-touch-icon-180.png` renders with a **black** fill on iOS home screens (iOS doesn't support alpha there) — known tradeoff of the no-background call (user's explicit "no yellow bg" request), not a bug, revisit if it looks wrong on an iPhone.

**Don't hand-copy the resulting base64 PNG output through the conversation** — long base64 strings get silently corrupted in transit (single-character corruption that preserves length, so a plain length check won't catch it). Instead, run a tiny local HTTP relay (plain Node `http` server on `127.0.0.1`, CORS-enabled) that the browser `fetch()`s the base64 to directly — the bytes never pass through generated text at all — then have the relay write the file and report back a SHA-256 of what it wrote. Finish with a from-scratch PNG chunk CRC32 walk (recompute each chunk's CRC and compare to the stored one) as the definitive integrity check on the assembled files.

`public/icons/icon-source.svg` and `icon-maskable-source.svg` still exist as a secondary, hand-vectored approximation of the same mark (kept loosely in sync with `WalletMark()` in `src/components/ui/BrandHeader.tsx`, which renders the mark inline in the app UI with `stroke="currentColor"` so it can adapt to theme/dark-mode) — but they are no longer the source the served PNGs are rasterized from. If the logo changes again, update `logo/logo.png` (or get a new master export) and redo the color-key/composite step; only update the two SVGs if the in-app inline mark should change too.

## Versioning

`package.json`'s `version` and `src/lib/whatsNew.ts`'s `APP_VERSION` are kept in sync by hand (no automated bump). `WHATS_NEW_ITEMS` is a flat list of the *current* release's highlights (replaced wholesale each release, not accumulated) — bump `CURRENT_WHATS_NEW_VERSION` (a date string) alongside it whenever you update the list, since that's what gates the auto-shown "What's new" modal (`WhatsNewModal.tsx`) for users who haven't seen the current version yet.
