import { createClient } from '@supabase/supabase-js'

// Note: intentionally not using createClient<Database>(...) here. supabase-js's typed
// generic requires the Database shape to satisfy its internal GenericSchema constraints
// exactly (Relationships, etc.) or every table's Row/Insert/Update silently collapses to
// `never`. src/types/database.types.ts documents the real schema for reference and is
// used directly by hooks (via explicit return-type annotations), which gives the same
// type safety at the call site without fighting that generic.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Fails loudly in dev rather than silently pretending requests will work.
  console.error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill in your Supabase project values.'
  )
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

export const DOCUMENTS_BUCKET = 'documents'
