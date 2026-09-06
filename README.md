# Ledgerly

A shared, multi-user personal finance tracker. Every signed-up user manages their own
transactions, budgets, goals, recurring payments, subscriptions, documents, and rules —
but everyone can see everyone else's **transactions** (read-only).

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
anywhere (not just your home Wi-Fi), deploy the production build (`npm run build`,
output in `dist/`) to a free static host such as Cloudflare Pages, Vercel, or Netlify.

Once you have a URL open on your phone:

- **iPhone**: open it in Safari → Share → **Add to Home Screen**.
- **Android**: open it in Chrome → menu → **Install app** (or use the install banner).

## Project layout

See the plan this was built from for the full architecture, data model, and Row Level
Security policies: `supabase/schema.sql` and `supabase/policies.sql` are the source of
truth for what's enforced server-side.
