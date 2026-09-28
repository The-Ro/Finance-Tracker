# LedgeEaze

A multi-user personal finance tracker. Every signed-up user manages their own transactions,
accounts and cards, budgets, goals, recurring payments, subscriptions, documents, and rules —
everything is private by default. Savings/current accounts, debit cards (each drawing from one
of those accounts) and credit cards (with limits, bills and statements) are kept separate. **Transactions** are the one thing that can be shared: approve someone
in Settings → Sharing and they get read-only access to yours (or request access to theirs).

Built as an installable Progressive Web App (PWA): it works on iOS and Android by adding
it to your home screen from the browser, with no App Store, no developer account, and no
native build tooling required.

## Stack

- React + Vite + TypeScript, Tailwind CSS
- Supabase (Postgres + Auth + Storage + Row Level Security) — free tier
- `vite-plugin-pwa` for installability

## First-time setup

1. **Backend**: follow [`supabase/README.md`](supabase/README.md) to create a free
   Supabase project, run the SQL files, and get your project URL + anon key.
2. **Frontend config**: copy `.env.example` to `.env.local` and fill in those two values.
3. Install dependencies and start the dev server:

   ```bash
   npm install
   npm run dev
   ```

4. Open the printed local URL in your browser. Sign up with a real email (confirmation is
   required), confirm it, then sign in.

## Trying it on your phone

While `npm run dev` is running, it's also reachable from other devices on the same Wi-Fi
network at `http://<your-computer's-LAN-IP>:5173`. For a stable link you can open from
anywhere (not just your home Wi-Fi), deploy the production build — see
[OPERATIONS.md](OPERATIONS.md) (`npm run build` + `npx wrangler deploy`, or any static host).

Once you have a URL open on your phone:

- **iPhone**: open it in Safari → Share → **Add to Home Screen**.
- **Android**: open it in Chrome → menu → **Install app** (or use the install banner).

## More docs

- [ARCHITECTURE.md](ARCHITECTURE.md) — how the app is put together: stack, source layout,
  data model, auth/RLS security model, state management, error handling.
- [OPERATIONS.md](OPERATIONS.md) — running it, deploying it, database migrations, logs and
  monitoring, known operational gaps.
- [supabase/README.md](supabase/README.md) — first-time Supabase project setup.

`supabase/schema.sql` and `supabase/policies.sql` are the source of truth for what's actually
enforced server-side — if the app's behavior and one of those files ever disagree, the SQL
is right and the app has a bug.
