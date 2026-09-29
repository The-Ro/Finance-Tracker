// Hand-written to match supabase/schema.sql. If you have the Supabase CLI set up,
// you can regenerate this from the live schema with:
//   supabase gen types typescript --project-id <ref> > src/types/database.types.ts

export type TransactionType = 'expense' | 'income' | 'transfer'
export type TransactionSource = 'manual' | 'csv'
export type CategoryKind = 'expense' | 'income'
/** Savings and current are both bank accounts; debit cards are separate (debit_cards table) and draw from one. */
export type CardNetwork = 'visa' | 'mastercard' | 'rupay' | 'amex' | 'diners' | 'other'

export type AnnouncementTone = 'info' | 'success' | 'warning'

/** admin_overview(): counts only -- no one's transactions or amounts. */
export interface AdminOverview {
  users: number
  signups_7d: number
  signups_30d: number
  signed_in_7d: number
  /** People who logged at least one entry in the last 7 days. */
  logging_7d: number
  transactions: number
  transactions_7d: number
  feedback_open: number
  errors_7d: number
  signups_by_week: { week: string; count: number }[]
}

export interface AdminUserRow {
  id: string
  display_name: string | null
  email: string
  created_at: string
  last_sign_in_at: string | null
  email_confirmed: boolean
  setup_done: boolean
  transactions: number
  last_entry_at: string | null
  is_admin: boolean
}

export interface AdminErrorGroup {
  message: string
  occurrences: number
  people: number
  first_seen: string
  last_seen: string
  versions: string[]
  sample_url: string | null
  sample_stack: string | null
}

export type AccountKind = 'savings' | 'current' | 'credit_card' | 'cash' | 'wallet'
export type PaymentMethod =
  | 'UPI'
  | 'Cash'
  | 'Debit card'
  | 'Credit card'
  | 'Wallet'
  | 'Net banking'
  | 'Cheque'
  | 'NEFT/RTGS/IMPS'
  | 'Other'
export type RecurringKind = 'recurring' | 'subscription'
/** Lent & borrowed: you lent it (they owe you) or borrowed it (you owe them). */
export type IouDirection = 'lent' | 'borrowed'
/** What a bell notification is about (notifications.kind). */
export type NotificationKind =
  | 'access_request'
  | 'access_approved'
  | 'access_declined'
  | 'feedback_reply'
  | 'split_added'
  | 'split_settled'
  | 'budget'
  | 'bill_overdue'
  | 'reminder'
export type Cadence = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'half-yearly' | 'annual'
export type DocumentStatus = 'stored' | 'review'
export type SelectedPeriod =
  | 'all-time'
  | 'this-month'
  | 'last-month'
  | 'last-3-months'
  | 'last-6-months'
  | 'this-year'
export type ThemeMode = 'light' | 'dark' | 'system'
export type ThemeAccent =
  | 'oxblood'
  | 'violet'
  | 'ocean'
  | 'sunset'
  | 'pink'
  | 'green'
  | 'sage'
  | 'mauve'
  | 'plum'
  | 'crimson'
  | 'charcoal'
  | 'custom'
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
export type ViewerAccessStatus = 'pending' | 'approved' | 'paused'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; display_name: string; email: string; avatar: string | null; created_at: string }
        Insert: { id: string; display_name: string; email: string; avatar?: string | null }
        Update: Partial<{ display_name: string; avatar: string | null }>
      }
      categories: {
        Row: {
          owner_user_id: string
          name: string
          kind: CategoryKind | null
          /** Icon key from src/lib/categoryIcon.ts; null = guessed from the name. Only this column is updatable. */
          icon: string | null
          created_by: string | null
          created_at: string
        }
        Insert: { owner_user_id: string; name: string; kind?: CategoryKind | null; icon?: string | null; created_by?: string | null }
        Update: { icon: string | null }
      }
      accounts: {
        Row: {
          owner_user_id: string
          name: string
          created_by: string | null
          created_at: string
          opening_balance: number
          kind: AccountKind
          credit_limit: number | null
          statement_day: number | null
          due_day: number | null
          closed_at: string | null
          /** Credit cards only (set_card_network). A RuPay card can pay by UPI. */
          card_network: CardNetwork | null
        }
        Insert: { owner_user_id: string; name: string; created_by?: string | null }
        Update: never
      }
      debit_cards: {
        Row: {
          id: string
          owner_user_id: string
          name: string
          last4: string | null
          /** The savings/current account the card draws from (accounts.name). */
          account: string
          network: CardNetwork | null
          created_at: string
        }
        Insert: { owner_user_id: string; name: string; last4?: string | null; account: string; network?: CardNetwork | null }
        Update: Partial<{ name: string; last4: string | null; account: string; network: CardNetwork | null }>
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
          category: string | null
          amount: number
          type: TransactionType
          account: string
          to_account: string | null
          remarks: string | null
          payment_method: PaymentMethod | null
          /** Set when paid with a debit card; `account` is then that card's linked account. */
          debit_card_id: string | null
          tags: string[]
          receipt: boolean
          receipt_document_id: string | null
          source: TransactionSource
          fingerprint: string
          created_at: string
          original_currency: string | null
          original_amount: number | null
          fx_rate: number | null
        }
        Insert: {
          id?: string
          owner_user_id: string
          date: string
          merchant: string
          category?: string | null
          amount: number
          type: TransactionType
          account: string
          to_account?: string | null
          remarks?: string | null
          payment_method?: PaymentMethod | null
          debit_card_id?: string | null
          tags?: string[]
          receipt?: boolean
          receipt_document_id?: string | null
          source?: TransactionSource
          fingerprint: string
          original_currency?: string | null
          original_amount?: number | null
          fx_rate?: number | null
        }
        Update: Partial<{
          category: string | null
          type: TransactionType
          account: string
          to_account: string | null
          remarks: string | null
          payment_method: PaymentMethod | null
          debit_card_id: string | null
          amount: number
          date: string
          merchant: string
          tags: string[]
          fingerprint: string
          original_currency: string | null
          original_amount: number | null
          fx_rate: number | null
        }>
      }
      budgets: {
        Row: {
          id: string
          owner_user_id: string
          category: string
          monthly_limit: number
          active: boolean
          rollover: boolean
          created_at: string
        }
        Insert: {
          id?: string
          owner_user_id: string
          category: string
          monthly_limit: number
          active?: boolean
          rollover?: boolean
        }
        Update: Partial<{ category: string; monthly_limit: number; active: boolean; rollover: boolean }>
      }
      transaction_splits: {
        Row: {
          id: string
          transaction_id: string
          owner_user_id: string
          with_user_id: string
          description: string
          date: string
          amount: number
          settled_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          transaction_id: string
          owner_user_id: string
          with_user_id: string
          description: string
          date: string
          amount: number
          settled_at?: string | null
        }
        Update: Partial<{ amount: number; settled_at: string | null }>
      }
      notifications: {
        Row: {
          id: string
          owner_user_id: string
          kind: NotificationKind
          title: string
          body: string | null
          url: string | null
          ref: string
          actor_user_id: string | null
          status: 'approved' | 'declined' | null
          created_at: string
          read_at: string | null
        }
        Insert: {
          owner_user_id: string
          kind: 'budget' | 'bill_overdue'
          title: string
          body?: string | null
          url?: string | null
          ref: string
        }
        Update: { read_at?: string | null }
      }
      push_subscriptions: {
        Row: {
          id: string
          owner_user_id: string
          endpoint: string
          p256dh: string
          auth: string
          created_at: string
          last_sent_on: string | null
        }
        Insert: never
        Update: never
      }
      ious: {
        Row: {
          id: string
          owner_user_id: string
          person: string
          direction: IouDirection
          amount: number
          date: string
          due_date: string | null
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          owner_user_id?: string
          person: string
          direction: IouDirection
          amount: number
          date?: string
          due_date?: string | null
          note?: string | null
        }
        Update: Partial<{
          person: string
          direction: IouDirection
          amount: number
          date: string
          due_date: string | null
          note: string | null
        }>
      }
      iou_payments: {
        Row: {
          id: string
          owner_user_id: string
          iou_id: string
          amount: number
          date: string
          created_at: string
        }
        Insert: {
          id?: string
          owner_user_id?: string
          iou_id: string
          amount: number
          date?: string
        }
        Update: Partial<{
          amount: number
          date: string
        }>
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
          /** Maintained by the recurring_items_keep_anchor_day trigger; absent until that migration runs. */
          anchor_day?: number | null
          /** Loan / EMI details (all three or none; migration 2026-09-29_recurring_loan_details). */
          loan_amount: number | null
          loan_tenure_months: number | null
          /** First EMI month, stored as the 1st of that month. */
          loan_start_date: string | null
          /** Annual interest rate in %, optional (only with loan details). */
          loan_interest_rate: number | null
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
          loan_amount?: number | null
          loan_tenure_months?: number | null
          loan_start_date?: string | null
          loan_interest_rate?: number | null
        }
        Update: Partial<{
          name: string
          category: string
          amount: number
          cadence: Cadence
          next_date: string
          account: string | null
          active: boolean
          loan_amount: number | null
          loan_tenure_months: number | null
          loan_start_date: string | null
          loan_interest_rate: number | null
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
      feedback: {
        Row: {
          id: string
          owner_user_id: string
          message: string
          created_at: string
          admin_reply: string | null
          replied_at: string | null
          reply_seen_at: string | null
          admin_dismissed_at: string | null
        }
        Insert: { id?: string; owner_user_id: string; message: string }
        Update: Partial<{
          admin_reply: string | null
          replied_at: string | null
          reply_seen_at: string | null
          admin_dismissed_at: string | null
        }>
      }
      client_errors: {
        Row: {
          id: string
          owner_user_id: string | null
          message: string
          stack: string | null
          url: string | null
          user_agent: string | null
          /** APP_VERSION of the build that reported it. */
          app_version: string | null
          created_at: string
        }
        Insert: {
          id?: string
          owner_user_id?: string | null
          message: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          app_version?: string | null
        }
        Update: never
      }
      app_announcements: {
        Row: {
          id: string
          message: string
          tone: AnnouncementTone
          active: boolean
          ends_at: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          message: string
          tone?: AnnouncementTone
          active?: boolean
          ends_at?: string | null
          created_by?: string | null
        }
        Update: Partial<{ message: string; tone: AnnouncementTone; active: boolean; ends_at: string | null }>
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
          theme_custom_color: string | null
          gender: Gender | null
          date_of_birth: string | null
          onboarding_completed: boolean
          interests: string[]
          zodiac_sign: ZodiacSign | null
          whats_new_seen_version: string | null
          dashboard_order: string[]
          dashboard_hidden: string[]
          summary_card_order: string[]
          summary_card_hidden: string[]
          setup_checklist_dismissed: boolean
          salary_amount: number | null
          salary_account: string | null
          salary_day: number | null
          /** YYYY-MM last answered on the payday prompt. */
          salary_confirmed_month: string | null
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
          theme_custom_color?: string | null
          gender?: Gender | null
          date_of_birth?: string | null
          onboarding_completed?: boolean
          interests?: string[]
          zodiac_sign?: ZodiacSign | null
          whats_new_seen_version?: string | null
          dashboard_order?: string[]
          dashboard_hidden?: string[]
          summary_card_order?: string[]
          summary_card_hidden?: string[]
          setup_checklist_dismissed?: boolean
          salary_amount?: number | null
          salary_account?: string | null
          salary_day?: number | null
          salary_confirmed_month?: string | null
        }
        Update: Partial<{
          assets_total: number
          liabilities_total: number
          net_worth_configured: boolean
          selected_period: SelectedPeriod
          currency: string
          theme_mode: ThemeMode
          theme_accent: ThemeAccent
          theme_custom_color: string | null
          gender: Gender | null
          date_of_birth: string | null
          onboarding_completed: boolean
          interests: string[]
          zodiac_sign: ZodiacSign | null
          whats_new_seen_version: string | null
          dashboard_order: string[]
          dashboard_hidden: string[]
          summary_card_order: string[]
          summary_card_hidden: string[]
          setup_checklist_dismissed: boolean
          salary_amount: number | null
          salary_account: string | null
          salary_day: number | null
          salary_confirmed_month: string | null
        }>
      }
    }
    Functions: {
      account_exists_for_reset: {
        Args: { p_email: string }
        Returns: boolean
      }
      save_push_subscription: {
        Args: { p_endpoint: string; p_p256dh: string; p_auth: string }
        Returns: undefined
      }
      delete_tag: {
        Args: { p_tag: string }
        Returns: undefined
      }
      set_card_network: {
        Args: { p_account: string; p_network: CardNetwork | null }
        Returns: undefined
      }
      admin_overview: {
        Args: Record<string, never>
        Returns: AdminOverview
      }
      admin_list_users: {
        Args: Record<string, never>
        Returns: AdminUserRow[]
      }
      admin_client_errors: {
        Args: { p_days?: number }
        Returns: AdminErrorGroup[]
      }
      mark_recurring_item_paid: {
        Args: { recurring_item_id: string; paid_on: string }
        Returns: undefined
      }
      is_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
      set_account_opening_balance: {
        Args: { p_account: string; p_amount: number }
        Returns: undefined
      }
      set_account_closed: {
        Args: { p_account: string; p_closed: boolean }
        Returns: undefined
      }
      set_account_details: {
        Args: {
          p_account: string
          p_kind: string
          p_credit_limit: number | null
          p_statement_day: number | null
          p_due_day: number | null
        }
        Returns: undefined
      }
      find_profile_by_email: {
        Args: { p_email: string }
        Returns: { id: string; display_name: string; email: string; avatar: string | null }[]
      }
      request_viewer_access: {
        Args: { p_email: string }
        Returns: undefined
      }
      /** Turns an account that was really a debit card into a debit card on p_linked_account, moving its transactions there. */
      convert_account_to_debit_card: {
        Args: { p_account: string; p_linked_account: string; p_last4: string | null }
        Returns: { card_id: string; moved: number; removed_transfers: number }
      }
    }
  }
}
