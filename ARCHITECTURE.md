# Architecture

## Shape

Ledgerly is a client-only single-page app — there is no custom backend server or API layer.
The React app talks directly to Supabase (Postgres + Auth + Storage) from the browser using
the anon key, and **Postgres Row Level Security (RLS) is the only authorization boundary**.
Every table has RLS enabled; there is no trusted server-side code that re-checks permissions,
so a policy gap in `supabase/policies.sql` is a real, exploitable gap — not just a UX bug.

```
Browser (React SPA)
  │  supabase-js, anon key (public by design — see .env.example)
  ▼
Supabase
  ├─ Postgres  — tables + RLS policies (supabase/schema.sql, supabase/policies.sql)
  ├─ Auth      — email/password, session persisted + auto-refreshed client-side
  └─ Storage   — `documents` bucket (receipts/statements)
```

Deployment is a static build: `npm run build` emits `dist/`, which is served as-is (no SSR,
no server runtime) — currently via Cloudflare Workers static assets (`wrangler.jsonc`), but
any static host works. See [OPERATIONS.md](OPERATIONS.md) for the deploy/rollback mechanics.

## Stack

- **React 18 + Vite + TypeScript**, Tailwind CSS for styling
- **TanStack Query** for all server state (every Supabase read/write goes through a query or
  mutation hook — no ad hoc `useEffect` fetching)
- **React Router v6**, one route per page under `src/pages/`, all lazy-loaded (`App.tsx`)
- **Recharts** for the dashboard charts, **@dnd-kit** for drag-and-drop reordering
- **`vite-plugin-pwa`** for the installable PWA (manifest + service worker, `autoUpdate`)
- **Supabase**: Postgres, Auth, Storage — free tier is sufficient at this app's scale

## Source layout

```
src/
  pages/        one file per route, thin — data-fetching + composing components
  components/
    dashboard/  Home page widgets (summary cards, charts, customize modal)
    transactions/, recurring/, budgets/, rules/, documents/, settings/  feature UI
    layout/     TopBar, BottomNav, Sidebar, AppShell (the authenticated shell)
    ui/         generic primitives — Modal, Dropdown, DateField, TextField, Button, Card
  context/      AuthContext, ThemeContext, ToastContext, GlobalModalsContext
  hooks/        one file per table/concern — useTransactions, useBudgets, useUserSettings, …
                each hook owns its React Query keys, its Supabase calls, and its mutations'
                optimistic-update / rollback logic
  lib/          pure functions — period math, recurring-cadence detection, currency
                formatting, color derivation, the fingerprint used for duplicate detection
  types/database.types.ts   hand-maintained mirror of the Postgres schema (see below)
```

`src/hooks/*` is the real boundary in this codebase: components never call `supabase.*`
directly (with rare, deliberate exceptions like `DashboardPage`'s recurring-items query) —
they call a hook, and the hook is the only thing that knows the table/column names.

### `database.types.ts` is hand-written, not generated

`supabase.auth`/`supabase.from(...)` is called via the plain (untyped) client, not
`createClient<Database>(...)` — the generic's structural constraints collapse every table to
`never` unless the shape matches exactly, which fights more than it helps here. Hooks
annotate their own return types using `Database['public']['Tables'][...]['Row']` from this
file instead. **Consequence: this file does not update itself.** Any schema migration that
adds/changes/removes a column must also update the matching `Row`/`Insert`/`Update` shape
here by hand, or TypeScript will happily compile against a schema that no longer exists.

## Data model

Every table (except `client_errors`, which is intentionally anonymous-friendly) carries an
`owner_user_id` and is scoped by RLS to "your own rows only" — with one deliberate exception:

- **`transactions`** is the one shared-read table. A row is visible to its owner, or to anyone
  the owner has approved via `viewer_access` (see below). It is **private by default** —
  nobody sees anyone else's transactions until explicitly approved. (`viewer_access_select`
  and `transactions_select_own_or_approved` in `supabase/policies.sql` are the enforcement;
  if you're auditing "who can see what," those two policies are the whole answer.)
- **`viewer_access`** is both the request and, once approved, the standing grant — one row,
  a `status` of `pending`/`approved`, either side can delete it (cancel/decline/revoke).
- **`profiles`** (display name, avatar, email) is also readable by anyone (needed to render
  another user's name/avatar next to their shared transactions).
- Everything else — `budgets`, `goals`, `recurring_items`, `dismissed_patterns`, `documents`,
  `rules`, `user_settings`, `feedback` — is strictly own-only for every operation.
- **`categories`/`accounts`/`tags`** are per-user lookup lists (composite PK
  `(owner_user_id, name)`), seeded with sensible defaults on signup (`handle_new_user()`) but
  fully editable — a user can rename their world without touching anyone else's.

A `transactions` row can be `expense`, `income`, or `transfer` (between two of the owner's own
accounts). `category` is nullable specifically for transfers — a transfer isn't spending or
income, so forcing it into a category (as an earlier version did, hardcoded to a sentinel
`'Needs review'` row) was both semantically wrong and fragile: it broke outright for any
account missing that exact category row. Every place that aggregates by category (budgets,
the category donut, recurring detection) filters to `type = 'expense'` first, so the null
never needs to be specially handled downstream.

## Auth & security model

- Email/password auth via Supabase Auth; email confirmation is required before first sign-in.
- `handle_new_user()` (a trigger on `auth.users` insert) seeds a new account's `profiles` row
  and default categories/accounts. `handle_user_email_update()` keeps `profiles.email` in
  sync if the auth email changes. `delete_own_account()` is a `SECURITY DEFINER` RPC,
  callable only by `authenticated`, that self-deletes via `auth.uid()` — every table's
  `owner_user_id` FK is `on delete cascade`, so this one call wipes a user's data entirely.
- All four `SECURITY DEFINER` functions (the three above plus `rls_auto_enable()`, an event
  trigger that auto-enables RLS on any newly created table as a safety net) have `EXECUTE`
  explicitly revoked from `PUBLIC` — Postgres grants it by default on function creation,
  which had left three purely-internal trigger functions callable as public
  `/rest/v1/rpc/*` endpoints for no reason (harmless, since they only work in their
  trigger/event-trigger context, but needless surface).
- The anon key in `.env.local` is meant to be public (see the comment in `.env.example`) —
  it identifies the project, it isn't a secret. RLS is what actually protects data, which is
  why every table has it enabled and every policy change has to be treated as a security
  change, not a convenience tweak.

## State & data flow

- **Server state** (anything from Supabase) lives in TanStack Query, keyed by
  `[table, ...params]` (e.g. `['transactions', 'mine', userId]`). Mutations either
  `invalidateQueries` on success or, for latency-sensitive UI (period selection, dashboard
  reordering), write an optimistic update via `setQueryData` and roll it back on error.
- **Client-only state** (open/closed modals, form drafts, the active dashboard period toggle
  before it's saved) is plain `useState`/`useContext` — there is no Redux/Zustand/etc.
- **Theme** is applied as CSS custom properties (`--accent`, `--accent-light`, `--accent-dark`)
  on `document.documentElement` — preset accents via static `[data-accent]` rules in
  `index.css`, a fully custom color via inline styles set in `ThemeContext` (inline wins over
  the class-based rules, and is cleared when switching back to a preset). A small inline
  script in `index.html` applies the last-known theme from `localStorage` before React even
  mounts, so there's no light-mode flash on load; it's re-synced against the signed-in user's
  saved preference (the actual source of truth) once the app loads.

## Error handling

- `src/components/ErrorBoundary.tsx` wraps the whole app (outside every provider, in
  `main.tsx`) and shows a "something went wrong, reload" screen instead of an uncaught render
  error unmounting the tree into a blank white page.
- `window.addEventListener('error'/'unhandledrejection', ...)` in `main.tsx` catches what the
  boundary can't — exceptions in event handlers and rejected promises never reach React's
  render cycle at all.
- All three funnel into `src/lib/logClientError.ts`, a best-effort, fire-and-forget insert
  into `public.client_errors` (message, stack, URL, user agent, and the signed-in user id if
  any). It's write-only from the client — no select policy — so it's a diagnostic channel
  read via the Supabase dashboard/SQL editor, not a user-facing feature.

## Known trade-offs / things not to assume

- **No opening-balance concept.** Account "balances" (used for the live overdraft hint on
  transfers) are derived purely by summing logged transaction history — there is no way to
  tell the app "this account already had ₹50,000 before I started tracking." A freshly-added
  account with real-world funds will show as having ₹0 until enough history accumulates.
- **No server-side validation beyond RLS/constraints.** Anything that isn't enforced by a
  Postgres `check` constraint or RLS policy (e.g. amount formatting, date sanity) is only
  validated in the React form. This is fine given the single-client-type, low-stakes nature
  of the app, but it means a raw API call bypassing the UI could insert malformed-but-allowed
  data.
- **The service worker precaches the whole built bundle** (`generateSW` mode). A deploy is
  "live" for new visitors immediately, but existing open tabs update on their next reload,
  not instantly — see OPERATIONS.md for what that means for rollouts.
