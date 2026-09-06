// Hand-written to match supabase/schema.sql. If you have the Supabase CLI set up,
// you can regenerate this from the live schema with:
//   supabase gen types typescript --project-id <ref> > src/types/database.types.ts

export type TransactionType = 'expense' | 'income'
export type TransactionSource = 'manual' | 'csv'
export type RecurringKind = 'recurring' | 'subscription'
export type Cadence = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual'
export type DocumentStatus = 'stored' | 'review'
export type SelectedPeriod =
  | 'all-time'
  | 'this-month'
  | 'last-month'
  | 'last-3-months'
  | 'last-6-months'
  | 'this-year'
export type ThemeMode = 'light' | 'dark' | 'system'
export type ThemeAccent = 'violet' | 'ocean' | 'sunset' | 'pink' | 'green'
export type Gender = 'male' | 'female' | 'prefer_not_to_say'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; display_name: string; email: string; avatar: string | null; created_at: string }
        Insert: { id: string; display_name: string; email: string; avatar?: string | null }
        Update: Partial<{ display_name: string; avatar: string | null }>
      }
      categories: {
        Row: { name: string; created_by: string | null; created_at: string }
        Insert: { name: string; created_by?: string | null }
        Update: never
      }
      accounts: {
        Row: { name: string; created_by: string | null; created_at: string }
        Insert: { name: string; created_by?: string | null }
        Update: never
      }
      tags: {
        Row: { name: string; created_by: string | null; created_at: string }
        Insert: { name: string; created_by?: string | null }
        Update: never
      }
      transactions: {
        Row: {
          id: string
          owner_user_id: string
          date: string
          merchant: string
          category: string
          amount: number
          type: TransactionType
          account: string
          tags: string[]
          receipt: boolean
          receipt_document_id: string | null
          source: TransactionSource
          fingerprint: string
          created_at: string
        }
        Insert: {
          id?: string
          owner_user_id: string
          date: string
          merchant: string
          category?: string
          amount: number
          type: TransactionType
          account: string
          tags?: string[]
          receipt?: boolean
          receipt_document_id?: string | null
          source?: TransactionSource
          fingerprint: string
        }
        Update: Partial<{
          category: string
          tags: string[]
        }>
      }
      budgets: {
        Row: {
          id: string
          owner_user_id: string
          category: string
          monthly_limit: number
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          owner_user_id: string
          category: string
          monthly_limit: number
          active?: boolean
        }
        Update: Partial<{ category: string; monthly_limit: number; active: boolean }>
      }
      goals: {
        Row: {
          id: string
          owner_user_id: string
          name: string
          target_amount: number
          current_amount: number
          due_date: string | null
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          owner_user_id: string
          name: string
          target_amount: number
          current_amount?: number
          due_date?: string | null
          note?: string | null
        }
        Update: Partial<{
          name: string
          target_amount: number
          current_amount: number
          due_date: string | null
          note: string | null
        }>
      }
      recurring_items: {
        Row: {
          id: string
          owner_user_id: string
          kind: RecurringKind
          name: string
          category: string
          amount: number
          cadence: Cadence
          next_date: string
          account: string | null
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          owner_user_id: string
          kind: RecurringKind
          name: string
          category: string
          amount: number
          cadence: Cadence
          next_date: string
          account?: string | null
          active?: boolean
        }
        Update: Partial<{
          name: string
          category: string
          amount: number
          cadence: Cadence
          next_date: string
          account: string | null
          active: boolean
        }>
      }
      dismissed_patterns: {
        Row: { owner_user_id: string; pattern_key: string; created_at: string }
        Insert: { owner_user_id: string; pattern_key: string }
        Update: never
      }
      documents: {
        Row: {
          id: string
          owner_user_id: string
          filename: string
          mime_type: string
          size: number
          storage_path: string
          status: DocumentStatus
          source: 'upload'
          created_at: string
        }
        Insert: {
          id?: string
          owner_user_id: string
          filename: string
          mime_type: string
          size: number
          storage_path: string
          status?: DocumentStatus
          source?: 'upload'
        }
        Update: Partial<{ status: DocumentStatus }>
      }
      rules: {
        Row: {
          id: string
          owner_user_id: string
          when_text: string
          then_text: string
          enabled: boolean
          created_at: string
        }
        Insert: {
          id?: string
          owner_user_id: string
          when_text: string
          then_text: string
          enabled?: boolean
        }
        Update: Partial<{ when_text: string; then_text: string; enabled: boolean }>
      }
      user_settings: {
        Row: {
          owner_user_id: string
          assets_total: number
          liabilities_total: number
          net_worth_configured: boolean
          selected_period: SelectedPeriod
          currency: string
          theme_mode: ThemeMode
          theme_accent: ThemeAccent
          gender: Gender | null
          date_of_birth: string | null
          updated_at: string
        }
        Insert: {
          owner_user_id: string
          assets_total?: number
          liabilities_total?: number
          net_worth_configured?: boolean
          selected_period?: SelectedPeriod
          currency?: string
          theme_mode?: ThemeMode
          theme_accent?: ThemeAccent
          gender?: Gender | null
          date_of_birth?: string | null
        }
        Update: Partial<{
          assets_total: number
          liabilities_total: number
          net_worth_configured: boolean
          selected_period: SelectedPeriod
          currency: string
          theme_mode: ThemeMode
          theme_accent: ThemeAccent
          gender: Gender | null
          date_of_birth: string | null
        }>
      }
    }
  }
}
