# Supabase setup for LedgeEaze

1. Create a free project at [supabase.com](https://supabase.com) (no credit card required).
2. In your new project, go to **SQL Editor** and run these three files in order:
   1. `schema.sql`
   2. `policies.sql`
   3. `seed.sql`
3. Go to **Authentication → Providers → Email** and make sure "Confirm email" is **enabled**
   (LedgeEaze requires email confirmation before login, per project settings).
4. Go to **Settings → API** and copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon / public key** → `VITE_SUPABASE_ANON_KEY`
5. In the project root, copy `.env.example` to `.env.local` and paste those two values in.
6. Run `npm install` then `npm run dev`.

The anon key is safe to ship in the frontend bundle — Row Level Security (`policies.sql`)
is what actually protects the data, not keeping that key secret. Never use or ship the
**service role** key anywhere in this app; it isn't needed.
