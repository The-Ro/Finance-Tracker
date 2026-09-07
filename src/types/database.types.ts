// Hand-written to match supabase/schema.sql. If you have the Supabase CLI set up,
// you can regenerate this from the live schema with:
//   supabase gen types typescript --project-id <ref> > src/types/database.types.ts

export type TransactionType = 'expense' | 'income' | 'transfer'
export type TransactionSource = 'manual' | 'csv'
export type CategoryKind = 'expense' | 'income'
export type PaymentMethod =
  | 'UPI'
  | 'Cash'
  | 'Debit card'
  | 'Credit card'
  | 'Net banking'
  | 'Cheque'
  | 'NEFT/RTGS/IMPS'
  | 'Other'
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
export type ThemeAccent = 'violet' | 'ocean' | 'sunset' | 'pink' | 'green' | 'sage' | 'mauve'
export type Gender = 'male' | 'female' | 'prefer_not_to_say'
export type ZodiacSign =
  | 'aries'
  | 'taurus'
  | 'gemini'
  | 'cancer'
  | 'leo'
  | 'virgo'
  | 'libra'
  | 'scorpio'
  | 'sagittarius'
  | 'capricorn'
  | 'aquarius'
  | 'pisces'
export type ViewerAccessStatus = 'pending' | 'approved'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; display_name: string; email: string; avatar: string | null; created_at: string }
        Insert: { id: string; display_name: string; email: string; avatar?: string | null }
        Update: Partial<{ display_name: string; avatar: string | null }>
      }
      categories: {
        Row: { owner_user_id: string; name: string; kind: CategoryKind | null; created_by: string | null; created_at: string }
        Insert: { owner_user_id: string; name: string; kind?: CategoryKind | null; created_by?: string | null }
        Update: never
      }
      accounts: {
        Row: { owner_user_id: string; name: string; created_by: string | null; created_at: string }
        Insert: { owner_user_id: string; name: string; created_by?: string | null }
        Update: never
      }
      tags: {
        Row: { owner_user_id: string; name: string; created_by: string | null; created_at: string }
        Insert: { owner_user_id: string; name: string; created_by?: string | null }
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
          to_account: string | null
          remarks: string | null
          payment_method: PaymentMethod | null
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
          to_account?: string | null
          remarks?: string | null
          payment_method?: PaymentMethod | null
          tags?: string[]
          receipt?: boolean
          receipt_document_id?: string | null
          source?: TransactionSource
          fingerprint: string
        }
        Update: Partial<{
          category: string
          type: TransactionType
          account: string
          to_account: string | null
          remarks: string | null
          payment_method: PaymentMethod | null
          amount: number
          date: string
          merchant: string
          tags: string[]
          fingerprint: string
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
      viewer_access: {
        Row: {
          id: string
          requester_user_id: string
          owner_user_id: string
          status: ViewerAccessStatus
          created_at: string
          responded_at: string | null
        }
        Insert: {
          id?: string
          requester_user_id: string
          owner_user_id: string
          status?: ViewerAccessStatus
        }
        Update: Partial<{ status: ViewerAccessStatus; responded_at: string | null }>
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
          onboarding_completed: boolean
          interests: string[]
          zodiac_sign: ZodiacSign | null
          whats_new_seen_version: string | null
          dashboard_order: string[]
          dashboard_hidden: string[]
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
          onboarding_completed?: boolean
          interests?: string[]
          zodiac_sign?: ZodiacSign | null
          whats_new_seen_version?: string | null
          dashboard_order?: string[]
          dashboard_hidden?: string[]
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
          onboarding_completed: boolean
          interests: string[]
          zodiac_sign: ZodiacSign | null
          whats_new_seen_version: string | null
          dashboard_order: string[]
          dashboard_hidden: string[]
        }>
      }
    }
  }
}
