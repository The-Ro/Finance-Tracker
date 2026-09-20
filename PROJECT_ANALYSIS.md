# LedgeEaze project assessment

**Assessment date:** 2026-09-13  
**Scope:** repository source, SQL/RLS definitions, build configuration, and local validation. This is a codebase assessment, not a penetration test or a comparison against the live Supabase project's actual configuration.

## Executive summary

LedgeEaze is a thoughtfully structured, client-only personal-finance PWA. It has a strong foundation for a small shared household or personal tracker: route-level code splitting, feature-oriented UI and data hooks, explicit Supabase RLS, documented operational practices, and a clear distinction between private data and approved shared transaction access.

The primary risks are not architectural fragility; they are quality controls and growth limits. There is currently no runnable lint setup or automated test suite, transaction reads silently stop at 5,000 rows, and “mark paid” spans two independent client-side writes rather than one database transaction. These should be addressed before adding substantially more financial workflows or users.

## What the project does

Users can manage transactions, recurring payments, subscriptions, budgets, goals, documents, categorization rules, and personal settings. Transactions and their attached documents can be shared read-only after an explicit `viewer_access` approval; budgets, goals, recurring items, settings, and other personal data remain private.

The deployed shape is deliberately simple:

```text
React PWA in the browser
        |
        | supabase-js with public anon key
        v
Supabase Auth + Postgres/RLS + Storage
        ^
        |
Cloudflare Workers serves the static Vite build
```

There is no custom application server, server-side rendering, background worker, cron process, realtime subscription, or CI pipeline.

## Architecture assessment

### Strengths

- **Clear client boundaries.** Pages compose feature components; feature hooks own Supabase queries and mutations; `lib/` contains reusable, mostly pure domain utilities. This keeps components from scattering database assumptions.
- **Appropriate state model.** TanStack Query owns remote data, while React context/local state owns session, theme, toasts, and modal state. This is a proportionate alternative to adding a global client-state library.
- **Practical PWA setup.** The build generates a manifest and service worker, includes a user-visible update banner, and is configured for SPA fallback on Cloudflare Workers.
- **Useful resilience measures.** Route-level lazy loading, a top-level React error boundary, and best-effort client-error logging make failures less likely to become blank screens or invisible incidents.
- **Good domain choices.** Transfer rows are separate from expenses/income; dates use local-calendar helpers instead of UTC serialization; transaction fingerprints prevent accidental duplicate imports.

### Constraints to preserve

- The browser is an untrusted client. RLS and database constraints—not hidden UI controls—are the authorization boundary.
- `src/types/database.types.ts`, `supabase/schema.sql`, and `supabase/policies.sql` are maintained manually and must change together.
- Recurring items do not advance automatically. Their next dates only move when the user marks an item paid.
- Account balances are derived from recorded transactions; there is no opening-balance model.

## Security and privacy assessment

The RLS model is generally strong and well documented:

- Each user-owned table is enabled for RLS and scoped to its owner.
- Transaction reads are explicitly extended to approved viewers only; writes remain owner-only.
- Private document objects use owner-prefixed paths, and approved viewers can read documents attached to the owner's shared data.
- Sensitive account deletion is performed through a narrow `SECURITY DEFINER` RPC; internal definer functions have public execution revoked.
- The public Supabase anon key is correctly treated as an identifier rather than a secret.

Areas requiring ongoing verification:

1. **Live database drift is the main security risk.** SQL files describe intent, but a prior foreign-key drift shows the live database can differ. After every migration, verify live constraints and policies and run Supabase security/performance advisors.
2. **Profile discovery is broad by design.** Any authenticated user can read every profile's display name, email, and avatar. This supports sharing UX, but it is more directory exposure than a strictly private finance app normally needs. If the product expands beyond trusted groups, consider exposing only minimal profile data or only profiles connected by sharing relationships.
3. **Admin access is email-based.** The hardcoded admin email is simple and auditable at current scale, but must remain synchronized between the SQL policy and `src/lib/admin.ts`. A database role/claim would become safer when multiple admins or delegated administration are needed.
4. **Validation is uneven.** RLS protects ownership, but many business rules are enforced only in React forms. Add database `check` constraints for important invariants (positive monetary amounts, valid date/value combinations, and transfer-account rules) if raw API misuse or integrations become more likely.

## Delivery and maintainability assessment

### Validation performed

`cmd /c "npm run build"` completed successfully on this checkout:

- TypeScript project build passed.
- Vite transformed 2,591 modules and produced a PWA precache of approximately 1.18 MiB.
- Vite reported two minified chunks above its 500 kB warning threshold: the application entry (~559 kB) and dashboard (~505 kB).

`npm run lint` is currently non-functional: the script invokes `eslint .`, but ESLint is not installed/declared in `package.json`. No `*test*` or `*spec*` files were found outside generated dependencies/build output.

### Quality gaps

- **No automated tests.** The financial calculations, period boundaries, CSV parsing, rule application, recurring detection, and RLS behaviour have no repository-level regression safety net.
- **Linting is only nominal.** A developer can believe the lint command passed if they do not notice the missing executable. Add ESLint and its TypeScript/React configuration, then make it a required pre-deploy check.
- **Manual deployment has no gate.** Build/deploy depends on a person running commands locally. The existing runbook is good, but CI should at least build and lint each pull request; deployment automation can follow.
- **Dependency/deployment reproducibility can improve.** `wrangler` is invoked through `npx` but not pinned, so deploy behaviour can change without a repository change.

## Performance and data-integrity findings

| Priority | Finding | Impact | Recommended direction |
|---|---|---|---|
| P1 | Transaction queries in `useTransactions.ts` use `.limit(5000)` with no pagination or user warning. | Older rows silently disappear from transaction views, dashboards, budgets, balances, exports, and recurrence detection once a user exceeds the limit. | Add paginated/infinite transaction fetching for the table; use purpose-built aggregate/range queries for dashboard calculations, or clearly constrain product retention. |
| P1 | `markPaid` inserts a transaction and then separately updates `recurring_items.next_date`. | A network failure after the insert leaves a real expense logged but the item still overdue; retrying may confuse users. | Replace this sequence with a narrow `SECURITY DEFINER` RPC that validates ownership and performs both writes atomically. |
| P2 | First-load bundles remain large despite route splitting. | Slower first interaction on mobile networks; dashboard/chart code is likely responsible for much of the weight. | Inspect the bundle, lazy-load charts/customization UI, and split shared vendor code deliberately where profiling confirms a benefit. |
| P2 | No opening-balance model. | Displayed balances and transfer overdraft hints can diverge from a user's actual bank balance. | Add an opening balance/date to accounts, or permit a clearly labelled opening-balance transaction. |
| P3 | Recurrence progression is entirely manual. | Users may accumulate overdue items and miss reminders if they do not open the app. | Keep this behaviour if intentional; otherwise add explicit notifications/background scheduling only after defining the desired delivery and privacy model. |

## Recommended delivery sequence

1. Restore a real quality gate: install/configure ESLint, add a `test` script, and create unit tests for date helpers, fingerprints, CSV parsing, rules, recurrence cadence, and balance calculation.
2. Add integration tests against a disposable Supabase project (or a scripted test schema) that prove RLS boundaries for owner, approved viewer, pending viewer, and unrelated user.
3. Move the recurring “mark paid” workflow into one atomic database RPC and document/revoke execution permissions consistently.
4. Design pagination and aggregates before the 5,000-row ceiling becomes a user-visible data-loss symptom.
5. Pin Wrangler, add `check`/`deploy` scripts, and introduce CI for build, lint, and tests. Add a protected deployment workflow when releases become collaborative.
6. Profile the production bundle after functional safeguards are in place; optimize the dashboard only where measurements justify the added complexity.

## Documentation map

- [README.md](README.md) — product overview and local setup.
- [ARCHITECTURE.md](ARCHITECTURE.md) — system design, data model, error handling, and security model.
- [OPERATIONS.md](OPERATIONS.md) — development, migration, deployment, monitoring, and operational gaps.
- [supabase/schema.sql](supabase/schema.sql) and [supabase/policies.sql](supabase/policies.sql) — server-side structure and authorization intent.

This assessment complements those documents: it highlights priorities and verification gaps rather than replacing their detailed implementation guidance.
