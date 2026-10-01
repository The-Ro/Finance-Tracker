import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { Dropdown } from '@/components/ui/Dropdown'
import { FieldError, FormError } from '@/components/ui/FieldError'
import { TagsField } from './TagsField'
import { AccountChips, type ChipGroup, type ChipOption } from './AccountChips'
import { AccountKindIcon, DebitCardIcon } from '@/components/ui/AccountKindIcon'
import { useAccountDetails, useCategories, useAccounts } from '@/hooks/useLookupLists'
import { useDebitCards } from '@/hooks/useDebitCards'
import { useAccountsInUse } from '@/hooks/useAccountsInUse'
import { debitCardLabel } from '@/lib/debitCards'
import {
  useAddTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
  useRecentAccounts,
  useAccountBalances,
  useMyTransactions,
  DuplicateTransactionError,
  type Transaction,
} from '@/hooks/useTransactions'
import { useDocuments, type DocumentRow } from '@/hooks/useDocuments'
import { useRules } from '@/hooks/useRules'
import { useAccountKinds, useCardStatuses, useClosedAccounts } from '@/hooks/useCards'
import { useApprovedConnections, useSplitMutations } from '@/hooks/useSplits'
import { useProfiles } from '@/hooks/useProfiles'
import { suggestEntry } from '@/lib/smartCategory'
import { usualEntries, type UsualEntry } from '@/lib/usualEntries'
import { evenShare } from '@/lib/splits'
import { countSecondaryFields, currencySymbol, orderAccountOptions, savedEntryMessage } from '@/lib/entryForm'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { formatDate, todayISO } from '@/lib/format'
import { SUPPORTED_CURRENCIES } from '@/lib/currency'
import { convertToHome, fetchFxRate } from '@/lib/fx'
import { PAYMENT_METHODS, accountsForMode, modeUsesDebitCards } from '@/lib/cardNetworks'
import { NewCategoryEditor, QuickAddCategory } from '@/components/ui/QuickAddCategory'
import { cleanAmountInput, groupAmountInput } from '@/lib/amountInput'
import type { PaymentMethod, TransactionType } from '@/types/database.types'


interface AddEntryModalProps {
  open: boolean
  onClose: () => void
  transaction?: Transaction | null
  /** Type a new entry starts on (quick actions, ?add=income etc.). Ignored when editing. */
  initialType?: TransactionType
  /** Starting values for a new entry, e.g. a card bill payment. Ignored when editing. */
  prefill?: EntryPrefill
}

export interface EntryPrefill {
  merchant?: string
  amount?: number
  toAccount?: string
  /** The "from" account, e.g. the bank a card bill is paid from. */
  account?: string
  /** YYYY-MM-DD, e.g. the statement date a missing card charge belongs to. */
  date?: string
  category?: string
}

const EMPTY_STATE = {
  type: 'expense' as TransactionType,
  amount: '',
  merchant: '',
  date: todayISO(),
  category: 'Needs review',
  account: '',
  toAccount: '',
  /** Set when paying with a debit card; `account` is then that card's linked account. */
  debitCardId: '',
  remarks: '',
  paymentMethod: '' as PaymentMethod | '',
  tags: [] as string[],
  hasReceipt: false,
  file: null as File | null,
  /** '' = the user's home currency. */
  currency: '',
  fxRate: '',
  /** "Share with everyone": people approved to see your transactions see this one. */
  shared: true,
}

const CURRENCY_CODES = SUPPORTED_CURRENCIES.map((c) => c.code)

const ACCOUNT_KEY = 'account:'
const DEBIT_KEY = 'debit:'

export function AddEntryModal({ open, onClose, transaction, initialType = 'expense', prefill }: AddEntryModalProps) {
  const [form, setForm] = useState(EMPTY_STATE)
  const [error, setError] = useState<string | null>(null)
  // Which field the error is about (null = the whole form, shown at the top).
  const [errorField, setErrorField] = useState<string | null>(null)
  // "Save anyway" after the not-enough-money warning, until the sheet resets.
  const overdrawOk = useRef(false)
  const [overdrawPending, setOverdrawPending] = useState(false)
  // Set when the last save attempt was rejected as a duplicate -- offers a
  // "Save anyway" retry instead of just leaving the user stuck, since the
  // fingerprint check can't tell a real duplicate from two distinct
  // transactions that happen to share date/merchant/amount/account (see
  // DuplicateTransactionError in useTransactions.ts).
  const [duplicatePending, setDuplicatePending] = useState(false)
  const [shakeField, setShakeField] = useState<string | null>(null)
  const [shakeToken, setShakeToken] = useState(0)
  // "INR · change" reveals the currency picker + rate; "More details" reveals
  // payment method, remarks, tags and receipt. Both open on their own when
  // editing an entry that uses them.
  // "Mode" pill next to the currency: how it was paid (UPI, debit/credit card...).
  const [showMode, setShowMode] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  // The New category box, shown under the chip row (Save / Cancel hide meanwhile).
  const [addingCategory, setAddingCategory] = useState(false)
  // Optional even split of a new expense with an approved connection.
  const [splitOn, setSplitOn] = useState(false)
  const [splitWith, setSplitWith] = useState('')
  const contentRef = useRef<HTMLDivElement>(null)
  const isEditing = !!transaction
  const isTransfer = form.type === 'transfer'

  const { userId } = useAuth()
  const { show } = useToast()
  const { expense: expenseCategories, income: incomeCategories } = useCategories()
  const categoryOptions = form.type === 'income' ? incomeCategories : expenseCategories
  const { data: accounts = [] } = useAccounts()
  const recentAccounts = useRecentAccounts(userId)
  const accountBalances = useAccountBalances(userId)
  const { data: myTransactions } = useMyTransactions(userId)
  const accountKinds = useAccountKinds()
  const { data: accountDetailsMap } = useAccountDetails()
  const closedAccounts = useClosedAccounts()
  const cardStatuses = useCardStatuses()
  const connections = useApprovedConnections()
  const { data: profiles = {} } = useProfiles()
  const { create: createSplit } = useSplitMutations()
  // Keep the selected category chip in view in its scrolling row (horizontal
  // only -- scrollIntoView would also scroll the sheet vertically).
  const categoryRowRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const row = categoryRowRef.current
    const chip = row?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (row && chip) row.scrollTo({ left: chip.offsetLeft - row.clientWidth / 2 + chip.clientWidth / 2, behavior: 'smooth' })
  }, [form.category, open])
  // Smart category: offered (never auto-applied) from the user's own past
  // entries at a similar merchant, for new entries only.
  const { format, currency: homeCurrency } = useFormatCurrency()
  const { data: rules = [] } = useRules()
  const addTransaction = useAddTransaction()
  const updateTransaction = useUpdateTransaction()
  const deleteTransaction = useDeleteTransaction()
  const documents = useDocuments()
  const saving =
    addTransaction.isPending || updateTransaction.isPending || documents.upload.isPending || createSplit.isPending

  const { data: debitCards = [], isSuccess: debitCardsLoaded } = useDebitCards()
  const { inUse, ready: usageReady } = useAccountsInUse()
  const cardsById = useMemo(() => new Map(debitCards.map((c) => [c.id, c])), [debitCards])
  const selectedCard = form.debitCardId ? cardsById.get(form.debitCardId) : undefined
  // "Like last time": what the user's own history says about this merchant --
  // usual category, the latest account / mode / card, and a repeated amount.
  // Only the parts that would change something (and still exist) are offered.
  const suggestion = useMemo(() => {
    if (isEditing || isTransfer || !myTransactions) return null
    const s = suggestEntry(form.merchant, form.type, myTransactions)
    if (!s) return null
    const category = s.category && s.category !== form.category && categoryOptions.includes(s.category) ? s.category : null
    const card = s.debitCardId ? cardsById.get(s.debitCardId) : undefined
    const account = s.account && s.account !== form.account && accounts.includes(s.account) ? s.account : null
    const paymentMethod = s.paymentMethod && s.paymentMethod !== form.paymentMethod ? (s.paymentMethod as PaymentMethod) : null
    const amount = s.amount && !form.amount ? s.amount : null
    if (!category && !account && !paymentMethod && !amount) return null
    return { category, account, paymentMethod, debitCardId: card ? card.id : null, amount, cardLabel: card ? debitCardLabel(card) : null }
  }, [isEditing, isTransfer, myTransactions, form.merchant, form.type, form.category, form.account, form.paymentMethod, form.amount, categoryOptions, accounts, cardsById])

  // "Your usual": entries logged again and again (by how often, how recently,
  // and the same weekday / time of day), one tap to fill in. Only on a fresh
  // new entry of that type, before anything is typed.
  const usual = useMemo(() => {
    if (isEditing || isTransfer || !myTransactions || !open) return []
    return usualEntries(myTransactions, new Date(), { limit: 6 }).filter(
      (u) => u.type === form.type && (!u.account || accounts.includes(u.account))
    )
  }, [isEditing, isTransfer, myTransactions, open, form.type, accounts])
  const showUsual = usual.length > 0 && !form.merchant.trim() && !form.amount
  const applyUsual = (u: UsualEntry) => {
    const card = u.debitCardId ? cardsById.get(u.debitCardId) : undefined
    setForm((f) => ({
      ...f,
      merchant: u.merchant,
      category: u.category && categoryOptions.includes(u.category) ? u.category : f.category,
      account: card ? card.account : u.account || f.account,
      debitCardId: card ? card.id : '',
      paymentMethod: card ? 'Debit card' : ((u.paymentMethod as PaymentMethod | null) ?? f.paymentMethod),
      amount: u.amount ? String(u.amount) : f.amount,
    }))
    // Straight to the amount when it isn't known yet.
    if (!u.amount) requestAnimationFrame(() => document.getElementById('entry-amount')?.focus())
  }

  // A new entry starts on the most recently used account (the first chip),
  // falling back to the first account in the list.
  const defaultAccount =
    recentAccounts.find((a) => accounts.includes(a) && !closedAccounts.has(a)) ??
    accounts.find((a) => !closedAccounts.has(a)) ??
    accounts[0] ??
    ''

  // Account chips: recent first, then the full list (custom accounts
  // included). Transfer's From/To rows exclude each other's current pick --
  // picking the same account on both sides isn't a valid transfer.
  const fromOrdered = useMemo(
    () =>
      orderAccountOptions(accounts, recentAccounts, {
        exclude: isTransfer ? form.toAccount : undefined,
        selected: form.account,
      }),
    [accounts, recentAccounts, isTransfer, form.toAccount, form.account]
  )
  const toOrdered = useMemo(
    () => orderAccountOptions(accounts, recentAccounts, { exclude: form.account, selected: form.toAccount }),
    [accounts, recentAccounts, form.account, form.toAccount]
  )

  // Seeded-but-never-used banks sit behind "+N more"; closed accounts are left
  // out entirely. Whatever this entry already points at always stays visible.
  const keepVisible = useMemo(
    () => new Set([form.account, form.toAccount, transaction?.account ?? '', transaction?.to_account ?? ''].filter(Boolean)),
    [form.account, form.toAccount, transaction]
  )
  const isVisibleAccount = (name: string) =>
    keepVisible.has(name) || (!closedAccounts.has(name) && (!usageReady || inUse.has(name)))
  const isTuckedAccount = (name: string) => !isVisibleAccount(name) && !closedAccounts.has(name)
  const toVisible = toOrdered.filter(isVisibleAccount)

  // Most recently used debit cards first; a card on a closed account only shows
  // if this entry already uses it.
  const orderedDebitCards = useMemo(() => {
    const rank = new Map<string, number>()
    for (const t of myTransactions ?? []) if (t.debit_card_id && !rank.has(t.debit_card_id)) rank.set(t.debit_card_id, rank.size)
    return debitCards
      .filter((c) => !closedAccounts.has(c.account) || c.id === form.debitCardId || c.id === transaction?.debit_card_id)
      .sort(
        (a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name)
      )
  }, [debitCards, myTransactions, closedAccounts, form.debitCardId, transaction])

  const accountChip = (name: string): ChipOption => ({
    key: ACCOUNT_KEY + name,
    label: name,
    icon: <AccountKindIcon kind={accountKinds.get(name)} size={14} className="shrink-0" />,
  })
  // The payment mode narrows where it can come out of (accountsForMode in
  // src/lib/cardNetworks.ts): Cash -> cash, Wallet -> wallets, Credit card ->
  // credit cards, Debit card -> the debit cards, UPI -> banks, wallets and
  // RuPay credit cards, bank modes -> banks; no mode or Other -> everything.
  // Transfers aren't narrowed, and the account already picked stays visible.
  const entryMode = isTransfer ? null : form.paymentMethod || null
  const modeAllows = (() => {
    const mode = entryMode
    if (!mode || mode === 'Other') return null
    const allowed = new Set(
      accountsForMode(
        mode,
        [...accountKinds.keys()].map((name) => ({ name, kind: accountKinds.get(name), network: accountDetailsMap?.get(name)?.network }))
      )
    )
    return (name: string) => allowed.has(name) || name === form.account
  })()
  const accountGroups = (ordered: string[], debit: typeof debitCards, narrow = false): ChipGroup[] => {
    const isCredit = (name: string) => accountKinds.get(name) === 'credit_card'
    const byMode = (name: string) => !narrow || !modeAllows || modeAllows(name)
    const shown = ordered.filter(isVisibleAccount).filter(byMode)
    const tucked = ordered.filter(isTuckedAccount).filter(byMode)
    if (narrow && !modeUsesDebitCards(entryMode)) debit = []
    // "Debit card" with cards to pick: just the cards (a card chip already
    // stands for its account), unless an older entry has no card on it.
    const cardsOnly = narrow && entryMode === 'Debit card' && debit.length > 0
    const plain = (names: string[]) =>
      names.filter((n) => !isCredit(n) && (!cardsOnly || (!selectedCard && n === form.account)))
    return [
      {
        id: 'accounts',
        label: 'Accounts',
        options: plain(shown).map(accountChip),
        more: cardsOnly ? [] : plain(tucked).map(accountChip),
      },
      {
        id: 'debit',
        label: 'Debit cards',
        options: debit.map((card) => ({
          key: DEBIT_KEY + card.id,
          label: debitCardLabel(card),
          icon: <DebitCardIcon size={14} className="shrink-0" />,
        })),
      },
      {
        id: 'credit',
        label: 'Credit cards',
        options: shown.filter(isCredit).map(accountChip),
        more: tucked.filter(isCredit).map(accountChip),
      },
    ]
  }
  // Income can't come in on a debit card; a transfer can go out on one (ATM
  // withdrawal) unless the card draws from the account it's going to.
  const fromGroups = accountGroups(
    fromOrdered,
    form.type === 'income' ? [] : orderedDebitCards.filter((c) => !isTransfer || c.account !== form.toAccount),
    true
  )
  const toGroups = accountGroups(toOrdered, [])
  // Cash: no account chips at all once the (only) cash account is picked.
  const cashAccountCount = [...accountKinds.entries()].filter(([name, kind]) => kind === 'cash' && !closedAccounts.has(name)).length
  const showFromPicker = !(entryMode === 'Cash' && accountKinds.get(form.account) === 'cash' && cashAccountCount <= 1)
  const fromValue = selectedCard ? DEBIT_KEY + selectedCard.id : ACCOUNT_KEY + form.account

  const pickFrom = (key: string) => {
    if (key.startsWith(DEBIT_KEY)) {
      const card = cardsById.get(key.slice(DEBIT_KEY.length))
      if (!card) return
      setForm((f) => ({
        ...f,
        account: card.account,
        debitCardId: card.id,
        paymentMethod: 'Debit card',
        toAccount: f.toAccount === card.account ? '' : f.toAccount,
      }))
      return
    }
    const account = key.slice(ACCOUNT_KEY.length)
    setForm((f) => ({
      ...f,
      account,
      debitCardId: '',
      // 'Debit card' came with the card chip (or can't apply to a credit card); drop it with the card.
      paymentMethod:
        f.paymentMethod === 'Debit card' && (f.debitCardId || accountKinds.get(account) === 'credit_card') ? '' : f.paymentMethod,
      toAccount: f.toAccount === account ? '' : f.toAccount,
    }))
  }

  const amountNum = Number(form.amount)

  // Foreign-currency entry (expense/income only): the typed amount is in
  // form.currency and gets converted to the home currency at the rate below,
  // fixed at entry time -- see src/lib/fx.ts.
  const isForeign = !isTransfer && !!form.currency && form.currency !== homeCurrency
  const entryCurrency = isForeign ? form.currency : homeCurrency
  const rateNum = Number(form.fxRate)
  const homeAmount = isForeign ? convertToHome(amountNum, rateNum) : amountNum
  const [rateStatus, setRateStatus] = useState<{ state: 'idle' | 'loading' | 'error'; asOf?: string }>({ state: 'idle' })
  // Set when prefilling an existing foreign entry, so opening it for edit keeps
  // its stored rate instead of silently re-fetching one.
  const keepStoredRate = useRef(false)

  useEffect(() => {
    if (!open || !isForeign || !form.date) return
    if (keepStoredRate.current) {
      keepStoredRate.current = false
      return
    }
    const controller = new AbortController()
    setRateStatus({ state: 'loading' })
    fetchFxRate(form.currency, homeCurrency, form.date, controller.signal)
      .then(({ rate, date }) => {
        setForm((f) => ({ ...f, fxRate: String(rate) }))
        setRateStatus({ state: 'idle', asOf: date })
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setRateStatus({ state: 'error' })
      })
    return () => controller.abort()
  }, [open, isForeign, form.currency, form.date, homeCurrency])

  // Live "does this overdraw the account" hint (transfers and spends). Derived from the
  // account's opening balance plus logged transaction history, so if we're
  // editing an existing transfer out of this same account, its own old amount
  // has to be added back first -- otherwise the balance already reflects this
  // transfer having happened, double-counting it.
  const fromAccountBalance = useMemo(() => {
    let balance = accountBalances.get(form.account) ?? 0
    if (transaction && transaction.type !== 'income' && transaction.account === form.account) {
      balance += transaction.amount
    }
    return balance
  }, [accountBalances, form.account, transaction])

  // Same idea as fromAccountBalance, but no overdraw check -- the "To"
  // account is only ever receiving money, so this is purely informational
  // (what does it currently hold, before this transfer lands).
  const toAccountBalance = useMemo(() => {
    let balance = accountBalances.get(form.toAccount) ?? 0
    if (transaction?.type === 'transfer' && transaction.to_account === form.toAccount) {
      balance -= transaction.amount
    }
    return balance
  }, [accountBalances, form.toAccount, transaction])

  useEffect(() => {
    if (!form.account && defaultAccount) {
      setForm((f) => ({ ...f, account: defaultAccount }))
    }
  }, [defaultAccount, form.account])

  // Switching Expense <-> Income can leave `category` pointing at a name
  // that isn't in the newly-relevant list (e.g. "Groceries" while on
  // Income) -- fall back to that list's own default instead of silently
  // keeping an option the dropdown no longer offers.
  useEffect(() => {
    if (isTransfer) return
    if (!categoryOptions.includes(form.category)) {
      setForm((f) => ({ ...f, category: categoryOptions[0] ?? 'Needs review' }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.type])

  const firstToAccount = toVisible[0] ?? toOrdered[0]
  useEffect(() => {
    if (isTransfer && !form.toAccount && firstToAccount) {
      setForm((f) => ({ ...f, toAccount: firstToAccount }))
    }
  }, [isTransfer, form.toAccount, firstToAccount])

  // Picking the cash account means the mode is Cash (which then hides the
  // account chips, see showFromPicker); a wallet with no mode yet is Wallet.
  const fromKind = accountKinds.get(form.account)
  const isCashAccount = fromKind === 'cash'
  useEffect(() => {
    if (isTransfer) return
    if (isCashAccount && form.paymentMethod !== 'Cash') setForm((f) => ({ ...f, paymentMethod: 'Cash', debitCardId: '' }))
    else if (fromKind === 'wallet' && !form.paymentMethod) setForm((f) => ({ ...f, paymentMethod: 'Wallet' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromKind, isTransfer])

  // Spending on a credit-card account is, by definition, paid by credit card:
  // fill that in when the user hasn't picked a method themselves.
  const isCardAccount = accountKinds.get(form.account) === 'credit_card'
  // Spending or moving more than a bank, cash or wallet account holds (cards can go below zero: that's what's owed).
  const overdraws =
    form.type !== 'income' &&
    !!form.account &&
    !isCardAccount &&
    accountBalances.has(form.account) &&
    homeAmount > fromAccountBalance + 0.005
  const toCard = isTransfer ? cardStatuses.get(form.toAccount) : undefined
  useEffect(() => {
    if (isCardAccount && !isTransfer && !form.paymentMethod) {
      setForm((f) => ({ ...f, paymentMethod: 'Credit card' }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCardAccount, isTransfer])

  const blankForm = () => ({
    ...EMPTY_STATE,
    date: todayISO(),
    type: initialType,
    // The type-change effect above doesn't fire when reopening on the same
    // type, so the default has to come from the list for the type opened with.
    category: (initialType === 'income' ? incomeCategories : expenseCategories)[0] ?? 'Needs review',
    account: defaultAccount,
    ...(prefill?.merchant ? { merchant: prefill.merchant } : {}),
    ...(prefill?.amount ? { amount: String(prefill.amount) } : {}),
    ...(prefill?.toAccount ? { toAccount: prefill.toAccount } : {}),
    ...(prefill?.account ? { account: prefill.account } : {}),
    ...(prefill?.date ? { date: prefill.date } : {}),
    ...(prefill?.category ? { category: prefill.category } : {}),
  })

  // Prefill from the transaction being edited (or reset to a blank form)
  // each time the modal opens -- not on every render, so typing doesn't
  // fight this effect.
  useEffect(() => {
    if (!open) return
    if (transaction) {
      setForm({
        type: transaction.type,
        amount: String(transaction.amount),
        merchant: transaction.merchant,
        date: transaction.date,
        category: transaction.category ?? 'Needs review',
        account: transaction.account,
        toAccount: transaction.to_account ?? '',
        debitCardId: transaction.debit_card_id ?? '',
        remarks: transaction.remarks ?? '',
        paymentMethod: transaction.payment_method ?? '',
        tags: transaction.tags,
        hasReceipt: transaction.receipt,
        shared: transaction.shared ?? true,
        file: null,
        currency: transaction.original_currency ?? '',
        fxRate: transaction.fx_rate != null ? String(transaction.fx_rate) : '',
        ...(transaction.original_amount != null ? { amount: String(transaction.original_amount) } : {}),
      })
      keepStoredRate.current = transaction.original_currency != null
      setDetailsOpen(transaction.original_currency != null || countSecondaryFields({ ...transaction, payment_method: null }) > 0)
    } else {
      setForm(blankForm())
      setDetailsOpen(false)
    }
    setSplitOn(false)
    setSplitWith('')
    setAddingCategory(false)
    clearError()
    setDuplicatePending(false)
    setRateStatus({ state: 'idle' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transaction, initialType, prefill])

  const reset = () => {
    setForm(blankForm())
    setDetailsOpen(false)
    setSplitOn(false)
    setSplitWith('')
    setAddingCategory(false)
    clearError()
    setDuplicatePending(false)
  }

  const handleClose = () => {
    if (saving) return
    reset()
    onClose()
  }

  // The form scrolls internally and the field a validation error is about
  // (merchant, account, ...) can easily be scrolled out of view by the time
  // someone hits Save -- setting the message alone left it rendered off the
  // bottom of the visible area with no visible sign anything happened.
  // Surfacing it at the very top of the form and scrolling back up there
  // means it's always seen right away, wherever the user was scrolled to.
  //
  // `field` additionally shakes that specific input so it's obvious which
  // one needs attention, not just that *something* does. Shaking works via
  // `key`, not just the class: if the same field fails twice in a row (user
  // hits Save again without changing anything), the class alone wouldn't
  // change and the CSS animation wouldn't restart -- bumping shakeToken
  // into the key forces React to remount that wrapper, restarting it every
  // time. A field tucked inside a collapsed section opens that section first.
  const clearError = () => {
    setError(null)
    setErrorField(null)
    setOverdrawPending(false)
    overdrawOk.current = false
  }
  const fail = (message: string, field?: string) => {
    setError(message)
    setErrorField(field ?? null)
    // A field error sits under its field (scrolled to the middle); anything else at the top.
    if (field) {
      requestAnimationFrame(() =>
        contentRef.current?.querySelector(`[data-field="${field}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      )
    } else {
      contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    }
    if (field === 'fxRate') setDetailsOpen(true)
    if (field === 'file') setDetailsOpen(true)
    if (field) {
      setShakeField(field)
      setShakeToken((t) => t + 1)
    }
  }
  const fieldErr = (field: string) => (error && errorField === field ? error : null)
  const shakeKey = (field: string) => (shakeField === field ? `${field}-${shakeToken}` : field)
  const shakeClass = (field: string) => (shakeField === field ? 'animate-shake' : undefined)

  const personName = (id: string) => {
    const p = profiles[id]
    return p?.displayName || p?.email || 'Someone'
  }
  const canSplit = !isEditing && form.type === 'expense' && connections.length > 0
  const splitTarget = canSplit && splitOn ? (connections.includes(splitWith) ? splitWith : connections[0]) : null

  // Undo from the "Saved" toast: removes the entry just logged (its split, if
  // any, goes with it via the FK cascade) and the receipt uploaded with it.
  const undoSave = async (saved: Transaction, receipt: DocumentRow | null) => {
    try {
      await deleteTransaction.mutateAsync(saved.id)
      if (receipt) await documents.remove.mutateAsync(receipt).catch(() => undefined)
      show('Entry removed', { tone: 'info' })
    } catch (e) {
      show(e instanceof Error ? e.message : "Couldn't undo that entry.", { tone: 'error' })
    }
  }

  const handleSubmit = async (opts?: { allowDuplicate?: boolean; allowOverdraw?: boolean }) => {
    setError(null)
    setErrorField(null)
    if (!opts?.allowDuplicate) setDuplicatePending(false)
    if (opts?.allowOverdraw) overdrawOk.current = true
    setOverdrawPending(false)

    if (!Number.isFinite(amountNum) || amountNum <= 0) return fail('Enter an amount above zero.', 'amount')
    if (!form.merchant.trim()) return fail('Enter who you paid or who paid you.', 'merchant')
    if (!form.date) return fail('Choose a date.', 'date')
    if (!form.account) return fail('Choose an account.', 'account')
    if (isTransfer && !form.toAccount) return fail('Choose an account to transfer to.', 'toAccount')
    if (isTransfer && form.toAccount === form.account) return fail('Choose a different account to transfer to.', 'toAccount')
    if (!isEditing && form.hasReceipt && !form.file) return fail('Choose a receipt file, or uncheck the receipt box.', 'file')
    if (isForeign && (!Number.isFinite(rateNum) || rateNum <= 0)) {
      return fail(`Enter the exchange rate from ${form.currency} to ${homeCurrency}.`, 'fxRate')
    }
    if (isForeign && homeAmount <= 0) return fail('That converts to less than 0.01. Check the amount and rate.', 'amount')
    // A bank, cash or wallet account can't go below zero without the user saying so.
    if (overdraws && !overdrawOk.current) {
      setOverdrawPending(true)
      return fail(
        `Not enough money in ${form.account}: it has ${format(Math.max(fromAccountBalance, 0))}. Pick another account, update its balance in Settings, or tap Save anyway.`,
        'account'
      )
    }

    const foreign = isForeign ? { currency: form.currency, amount: amountNum, rate: rateNum } : null

    const category = isTransfer ? null : form.category
    const toAccount = isTransfer ? form.toAccount : null
    // The card only counts when it still draws from the chosen account (the
    // database rejects anything else) and the entry isn't income.
    const cardId = form.type !== 'income' && selectedCard && selectedCard.account === form.account ? selectedCard.id : ''
    const paymentMethod = cardId ? 'Debit card' : form.paymentMethod || null

    try {
      if (transaction) {
        // undefined leaves the stored card alone (only while cards are still
        // loading and nothing card-related changed); null clears it.
        const cardUnresolved =
          !debitCardsLoaded &&
          !!transaction.debit_card_id &&
          form.debitCardId === transaction.debit_card_id &&
          form.account === transaction.account &&
          form.type !== 'income'
        const debitCardId = cardId || (cardUnresolved ? undefined : transaction.debit_card_id ? null : undefined)
        await updateTransaction.mutateAsync({
          id: transaction.id,
          type: form.type,
          amount: homeAmount,
          merchant: form.merchant,
          date: form.date,
          category,
          account: form.account,
          toAccount,
          remarks: form.remarks,
          paymentMethod: cardUnresolved ? form.paymentMethod || null : paymentMethod,
          debitCardId,
          tags: form.tags,
          foreign,
          shared: form.shared,
          allowDuplicate: opts?.allowDuplicate,
        })
        reset()
        onClose()
        return
      }

      let receipt: DocumentRow | null = null
      if (form.hasReceipt && form.file) {
        receipt = await documents.upload.mutateAsync(form.file)
      }

      const saved = await addTransaction.mutateAsync({
        type: form.type,
        amount: homeAmount,
        merchant: form.merchant,
        date: form.date,
        category,
        account: form.account,
        toAccount,
        remarks: form.remarks,
        paymentMethod,
        debitCardId: cardId || null,
        tags: form.tags,
        receipt: form.hasReceipt,
        receiptDocumentId: receipt?.id ?? null,
        rules: rules.map((r) => ({ whenText: r.when_text, thenText: r.then_text, enabled: r.enabled })),
        foreign,
        shared: form.shared,
        allowDuplicate: opts?.allowDuplicate,
      })

      // The entry is saved at this point; a failed split doesn't undo it --
      // it can still be split later from the entry's Split button.
      let splitError: string | null = null
      if (splitTarget && saved.type === 'expense') {
        try {
          await createSplit.mutateAsync({ transaction: saved, withUserId: splitTarget, amount: evenShare(saved.amount) })
        } catch (e) {
          splitError = e instanceof Error ? e.message : 'Could not save the split.'
        }
      }

      reset()
      onClose()
      show(savedEntryMessage(saved.merchant, format(saved.amount)), {
        action: { label: 'Undo', onClick: () => void undoSave(saved, receipt) },
      })
      if (splitError) {
        show(`Saved, but the split didn't go through: ${splitError}`, { tone: 'error', duration: 6000 })
      }
    } catch (e) {
      if (e instanceof DuplicateTransactionError) {
        setDuplicatePending(true)
        fail(e.message)
      } else {
        fail(e instanceof Error ? e.message : 'Something went wrong saving this entry.')
      }
    }
  }

  const secondaryCount = countSecondaryFields({
    payment_method: null, // shown on the Mode pill, not under More details
    remarks: form.remarks,
    tags: form.tags,
    receipt: !isEditing && form.hasReceipt,
  }) + (isForeign ? 1 : 0)

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEditing ? 'Edit entry' : 'New entry'}
      contentRef={contentRef}
      footer={
        addingCategory ? undefined : (
        // No Cancel: the X in the header closes (user request); Save takes the full width.
        <div className="flex gap-2">
          {(duplicatePending || overdrawPending) && (
            <Button
              variant="secondary"
              onClick={() => handleSubmit({ allowDuplicate: duplicatePending || undefined, allowOverdraw: overdrawPending || undefined })}
              disabled={saving}
            >
              Save anyway
            </Button>
          )}
          <Button onClick={() => handleSubmit()} disabled={saving} className="flex-1 font-semibold">
            {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Save entry'}
          </Button>
        </div>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <FormError message={errorField ? null : error} />

        <div role="group" aria-label="Entry type" className="grid grid-cols-3 gap-1 rounded-xl border border-app-border p-1">
          {(['expense', 'income', 'transfer'] as TransactionType[]).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={form.type === t}
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  type: t,
                  ...(t === 'transfer' ? { currency: '', fxRate: '' } : {}),
                  // Income can't carry a debit card; drop the card and the method it set.
                  ...(t === 'income' && f.debitCardId
                    ? { debitCardId: '', paymentMethod: f.paymentMethod === 'Debit card' ? '' : f.paymentMethod }
                    : {}),
                }))
              }
              className={clsx(
                'min-h-[44px] rounded-lg text-sm font-semibold capitalize transition-colors duration-200',
                form.type === t ? 'bg-accent text-white' : 'text-slate-500 hover:bg-slate-50'
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {showUsual && (
          <div className="animate-fade-in -mb-1 flex min-w-0 flex-col gap-1.5">
            <span className="text-helper font-medium text-slate-600">Your usual</span>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" style={{ scrollbarWidth: 'none' }}>
              {usual.map((u) => (
                <button
                  key={u.merchant}
                  type="button"
                  onClick={() => applyUsual(u)}
                  className="press flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-app-border bg-app-card px-3 text-helper font-medium text-slate-700 hover:border-accent"
                >
                  <span className="max-w-[10rem] truncate">{u.merchant}</span>
                  {u.amount != null && <span className="tabular-nums text-slate-500">{format(u.amount)}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* The amount leads: one big serif figure, centered, with the currency as a
            compact "INR · change" control that reveals the picker and rate. */}
        <div
          key={shakeKey('amount')}
          data-field="amount"
          className={clsx('flex flex-col items-center gap-1.5 py-1', shakeClass('amount'))}
        >
          <label
            htmlFor="entry-amount"
            className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500"
          >
            {isForeign ? `Amount in ${form.currency}` : 'Amount'}
          </label>
          <div className="flex max-w-full items-baseline justify-center gap-1">
            <span aria-hidden="true" className="font-serif text-3xl text-slate-400">
              {currencySymbol(entryCurrency)}
            </span>
            <input
              id="entry-amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              // Shown with commas ("62,000"); the form keeps the plain number.
              value={groupAmountInput(form.amount)}
              onChange={(e) => setForm((f) => ({ ...f, amount: cleanAmountInput(e.target.value) }))}
              style={{ width: `${Math.min(Math.max(groupAmountInput(form.amount).length, 1), 14) + 0.75}ch` }}
              aria-invalid={fieldErr('amount') ? true : undefined}
              className={clsx(
                'amount-input min-w-[2ch] max-w-full border-0 border-b-2 bg-transparent p-0 text-center font-serif text-5xl font-semibold tabular-nums text-slate-900 transition-colors placeholder:text-slate-300 focus:border-accent focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
                fieldErr('amount') ? 'border-danger' : 'border-transparent'
              )}
            />
          </div>
          <FieldError message={fieldErr('amount')} />
          <div className="flex flex-wrap items-center justify-center gap-2">
          {!isTransfer && (
            <button
              type="button"
              aria-expanded={showMode}
              aria-controls="entry-mode-panel"
              onClick={() => setShowMode((v) => !v)}
              className={clsx(
                'inline-flex min-h-[44px] items-center gap-1 rounded-full border px-3 text-helper font-semibold transition-colors',
                form.paymentMethod
                  ? 'border-accent bg-accent-light text-accent-on-light'
                  : 'border-app-border text-slate-600 hover:border-accent hover:text-accent-dark'
              )}
            >
              {form.paymentMethod || 'Mode'}
              <ChevronDown
                size={14}
                aria-hidden="true"
                className={clsx('transition-transform duration-200', showMode && 'rotate-180')}
              />
            </button>
          )}
          </div>
          {showMode && !isTransfer && (
            <div
              id="entry-mode-panel"
              role="group"
              aria-label="Payment mode"
              className="animate-fade-in-up -mx-1 flex max-w-full gap-1.5 overflow-x-auto px-1 pb-1"
              style={{ scrollbarWidth: 'none' }}
            >
              {PAYMENT_METHODS.map((m) => {
                const selected = form.paymentMethod === m
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setForm((f) => {
                        const paymentMethod = selected ? '' : m
                        // An account the new mode can't use (a bank under "Credit card", a
                        // Visa card under UPI) moves to the most recent one it can.
                        let account = f.account
                        // "Debit card" picks a card: the one already chosen, else one on this
                        // account, else the most recently used.
                        if (paymentMethod === 'Debit card' && f.type === 'expense') {
                          const card =
                            (f.debitCardId ? cardsById.get(f.debitCardId) : undefined) ??
                            orderedDebitCards.find((c) => c.account === f.account) ??
                            orderedDebitCards[0]
                          if (card) return { ...f, paymentMethod, account: card.account, debitCardId: card.id }
                        }
                        // Otherwise an account the new mode can't use (a bank under "Credit
                        // card", a Visa card under UPI) moves to the most recent one it can.
                        if (paymentMethod) {
                          const allowed = new Set(
                            accountsForMode(
                              paymentMethod,
                              fromOrdered.map((name) => ({ name, kind: accountKinds.get(name), network: accountDetailsMap?.get(name)?.network }))
                            )
                          )
                          if (!allowed.has(account)) {
                            account =
                              fromOrdered.find((n) => allowed.has(n) && isVisibleAccount(n)) ??
                              fromOrdered.find((n) => allowed.has(n)) ??
                              ''
                          }
                        }
                        // Any mode other than 'Debit card' means it wasn't the card after all.
                        return { ...f, paymentMethod, account, debitCardId: paymentMethod === 'Debit card' ? f.debitCardId : '' }
                      })
                      setShowMode(false)
                    }}
                    className={clsx(
                      'min-h-[44px] shrink-0 whitespace-nowrap rounded-full border px-3 text-helper font-medium transition-colors active:scale-95',
                      selected
                        ? 'animate-pop-in border-accent bg-accent-light text-accent-on-light'
                        : 'border-app-border text-slate-600 hover:border-accent hover:text-accent-dark'
                    )}
                  >
                    {m}
                  </button>
                )
              })}
            </div>
          )}
          {isForeign && (
            <p
              className={clsx(
                'text-center text-helper',
                rateStatus.state === 'error' && !(homeAmount > 0) ? 'text-caution' : 'text-slate-500'
              )}
            >
              {Number.isFinite(homeAmount) && homeAmount > 0
                ? `Saved as ${format(homeAmount)}${
                    rateStatus.state !== 'error' && rateStatus.asOf
                      ? ` (ECB rate for ${formatDate(rateStatus.asOf)}, editable)`
                      : ''
                  }`
                : rateStatus.state === 'error'
                  ? "Couldn't look up a rate. Type the one you were charged."
                  : rateStatus.state === 'loading'
                    ? 'Looking up the exchange rate…'
                    : 'Enter the amount and rate to see the converted value.'}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
          <div key={shakeKey('merchant')} data-field="merchant" className={shakeClass('merchant')}>
            <TextField
              label={form.type === 'income' ? 'Received from' : isTransfer ? 'What for' : 'Paid to'}
              id="entry-merchant"
              placeholder={form.type === 'income' ? 'e.g. Salary' : isTransfer ? 'e.g. Card payment' : 'e.g. Amazon'}
              maxLength={60}
              error={fieldErr('merchant')}
              value={form.merchant}
              onChange={(e) => setForm((f) => ({ ...f, merchant: e.target.value }))}
            />
            {suggestion && (
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    category: suggestion.category ?? f.category,
                    account: suggestion.account ?? f.account,
                    // The card comes with its own account and "Debit card"; any other account drops a picked card.
                    debitCardId: suggestion.debitCardId ?? (suggestion.account ? '' : f.debitCardId),
                    paymentMethod: suggestion.debitCardId ? 'Debit card' : (suggestion.paymentMethod ?? f.paymentMethod),
                    amount: suggestion.amount ? String(suggestion.amount) : f.amount,
                  }))
                }
                className="animate-fade-in mt-1.5 inline-flex min-h-[32px] max-w-full items-center gap-1.5 rounded-full bg-accent-light px-3 text-left text-helper font-medium text-accent-on-light"
              >
                <span className="truncate">
                  Use{' '}
                  {[
                    suggestion.category,
                    suggestion.cardLabel ?? suggestion.account,
                    suggestion.paymentMethod && !suggestion.debitCardId ? `via ${suggestion.paymentMethod}` : null,
                    suggestion.amount ? format(suggestion.amount) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  , like last time
                </span>
              </button>
            )}
          </div>
          <div key={shakeKey('date')} data-field="date" className={shakeClass('date')}>
            <TextField
              label="Date"
              id="entry-date"
              type="date"
              error={fieldErr('date')}
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
        </div>

        {!isTransfer && (
          <div className="flex min-w-0 flex-col gap-1.5">
            <span id="entry-category-label" className="text-helper font-medium text-slate-600">
              Category
            </span>
            {/* One horizontally scrolling row of chips (full list, custom categories
                included): one tap to pick, and it stays a single line tall instead of
                wrapping into a block that pushes the rest of the form down. */}
            <div
              role="group"
              aria-labelledby="entry-category-label"
              ref={categoryRowRef}
              className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
              style={{ scrollbarWidth: 'none' }}
            >
              {categoryOptions.map((option) => {
                const selected = form.category === option
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setForm((f) => ({ ...f, category: option }))}
                    className={
                      'min-h-[44px] shrink-0 whitespace-nowrap rounded-full border px-3 text-helper font-medium transition-colors active:scale-95 ' +
                      (selected
                        ? 'border-accent bg-accent-light text-accent-on-light'
                        : 'border-app-border text-slate-600 hover:border-accent hover:text-accent-dark')
                    }
                  >
                    {option}
                  </button>
                )
              })}
              <QuickAddCategory
                kind={form.type === 'income' ? 'income' : 'expense'}
                onAdded={(name) => setForm((f) => ({ ...f, category: name }))}
                onOpen={() => setAddingCategory(true)}
              />
            </div>
            {addingCategory && (
              <NewCategoryEditor
                kind={form.type === 'income' ? 'income' : 'expense'}
                onAdded={(name) => {
                  setForm((f) => ({ ...f, category: name }))
                  setAddingCategory(false)
                }}
                onCancel={() => setAddingCategory(false)}
              />
            )}
          </div>
        )}

        {showFromPicker && (
        <div key={shakeKey('account')} data-field="account" className={shakeClass('account')}>
          <AccountChips
            label={isTransfer ? 'From' : form.type === 'income' ? 'Into' : 'Paid with'}
            groups={fromGroups}
            value={fromValue}
            onChange={pickFrom}
            emptyText="No accounts yet. Add one in Settings, Accounts & cards."
          />
          <FieldError message={fieldErr('account')} />
          {selectedCard && !isTransfer && (
            <p className="mt-1 text-helper text-slate-500">
              Comes out of <span className="font-medium text-slate-700">{selectedCard.account}</span>
              {accountBalances.has(selectedCard.account) && ` · ${format(fromAccountBalance)} there now`}
            </p>
          )}
          {!isTransfer && overdraws && !fieldErr('account') && (
            <p className="mt-1 text-helper font-medium text-caution">
              Not enough money in {form.account}: only {format(Math.max(fromAccountBalance, 0))} there
            </p>
          )}
          {isTransfer && form.account && !isCardAccount && (
            <p
              className={clsx(
                'mt-1 text-helper',
                amountNum > fromAccountBalance ? 'font-medium text-caution' : 'text-slate-400'
              )}
            >
              {amountNum > fromAccountBalance
                ? `Only ${format(fromAccountBalance)} available in ${form.account}`
                : `${format(fromAccountBalance)} available in ${form.account}`}
            </p>
          )}
        </div>
        )}

        {isTransfer && (
          <div key={shakeKey('toAccount')} data-field="toAccount" className={shakeClass('toAccount')}>
            <AccountChips
              label="To"
              groups={toGroups}
              value={ACCOUNT_KEY + form.toAccount}
              onChange={(key) => setForm((f) => ({ ...f, toAccount: key.slice(ACCOUNT_KEY.length) }))}
              emptyText="No other accounts yet. Add one in Settings, Accounts & cards."
            />
            <FieldError message={fieldErr('toAccount')} />
            {form.toAccount && (
              <p className="mt-1 text-helper text-slate-400">
                {toCard
                  ? toCard.bill && toCard.bill.due > 0
                    ? `${format(toCard.bill.due)} due on this card's last statement · ${format(toCard.owed)} owed in total`
                    : `${format(toCard.owed)} owed on ${form.toAccount}`
                  : `${format(toAccountBalance)} available in ${form.toAccount}`}
              </p>
            )}
          </div>
        )}

        {canSplit && (
          <div className="flex flex-col gap-2 rounded-xl border border-app-border px-3 py-1">
            <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 text-sm font-medium text-slate-700">
              <span>{connections.length === 1 ? `Split with ${personName(connections[0])}` : 'Split with someone'}</span>
              <input
                type="checkbox"
                role="switch"
                checked={splitOn}
                onChange={(e) => {
                  setSplitOn(e.target.checked)
                  if (e.target.checked && !connections.includes(splitWith)) setSplitWith(connections[0])
                }}
                className="h-5 w-5 rounded border-app-border"
              />
            </label>
            {splitOn && (
              <div className="animate-fade-in-up flex flex-col gap-2 pb-2">
                {connections.length > 1 && (
                  <div
                    role="group"
                    aria-label="Split with"
                    className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
                    style={{ scrollbarWidth: 'none' }}
                  >
                    {connections.map((id) => {
                      const selected = splitTarget === id
                      return (
                        <button
                          key={id}
                          type="button"
                          aria-pressed={selected}
                          title={profiles[id]?.email}
                          onClick={() => setSplitWith(id)}
                          className={clsx(
                            'min-h-[44px] shrink-0 whitespace-nowrap rounded-full border px-3 text-helper font-medium transition-colors active:scale-95',
                            selected
                              ? 'border-accent bg-accent-light text-accent-on-light'
                              : 'border-app-border text-slate-600 hover:border-accent hover:text-accent-dark'
                          )}
                        >
                          {personName(id)}
                        </button>
                      )
                    })}
                  </div>
                )}
                <p className="text-helper text-slate-500">
                  {splitTarget && Number.isFinite(homeAmount) && homeAmount > 0
                    ? `${personName(splitTarget)} will owe you ${format(evenShare(homeAmount))}, half of this expense.`
                    : 'Split evenly: they owe you half.'}{' '}
                  You can change it later from the entry's Split button.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Share with everyone: on by default; off hides this entry from the
            people approved to see your transactions (RLS: transactions.shared). */}
        <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border border-app-border px-3">
          <input
            type="checkbox"
            checked={form.shared}
            onChange={(e) => setForm((f) => ({ ...f, shared: e.target.checked }))}
            className="h-5 w-5 shrink-0 accent-[rgb(var(--accent))]"
          />
          <span className="flex min-w-0 flex-col">
            <span className="text-sm font-medium text-slate-800">Share with everyone</span>
            <span className="text-helper text-slate-500">
              {form.shared ? 'People who can see your transactions will see this.' : 'Only you see what it is. Others see a blurred row.'}
            </span>
          </span>
        </label>

        <div className="rounded-xl border border-app-border">
          <button
            type="button"
            aria-expanded={detailsOpen}
            aria-controls="entry-more-details"
            onClick={() => setDetailsOpen((v) => !v)}
            className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <span className="flex items-center gap-2">
              More details
              {secondaryCount > 0 && (
                <span className="rounded-full bg-accent-light px-2 py-0.5 text-helper font-semibold text-accent-on-light">
                  {secondaryCount}
                </span>
              )}
            </span>
            <span className="flex items-center gap-1 text-helper font-normal text-slate-400">
              {!detailsOpen && (isTransfer ? 'Note, tags, receipt' : 'Currency, note, tags')}
              <ChevronDown
                size={16}
                aria-hidden="true"
                className={clsx('shrink-0 transition-transform duration-200', detailsOpen && 'rotate-180')}
              />
            </span>
          </button>

          {detailsOpen && (
            <div id="entry-more-details" className="animate-fade-in-up flex flex-col gap-4 border-t border-app-border p-3">
              {/* Currency lives here: most entries are in the home currency, so it
                  stays out of the way until needed. A foreign entry still shows
                  its symbol on the amount and "Saved as ₹X" under it. */}
              {!isTransfer && (
                <div id="entry-currency-panel" className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-helper font-medium text-slate-600">Currency</label>
                    <Dropdown
                      options={CURRENCY_CODES}
                      value={form.currency || homeCurrency}
                      aria-label="Currency"
                      onChange={(e) =>
                        setForm((f) => ({ ...f, currency: e.target.value === homeCurrency ? '' : e.target.value, fxRate: '' }))
                      }
                    />
                  </div>
                  {isForeign && (
                    <div key={shakeKey('fxRate')} data-field="fxRate" className={shakeClass('fxRate')}>
                      <TextField
                        label={`1 ${form.currency} = ? ${homeCurrency}`}
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        placeholder={rateStatus.state === 'loading' ? 'Looking up…' : 'Rate'}
                        error={fieldErr('fxRate')}
                        value={form.fxRate}
                        onChange={(e) => setForm((f) => ({ ...f, fxRate: e.target.value }))}
                      />
                    </div>
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 gap-3">
                <TextField
                  label="Note"
                  id="entry-remarks"
                  placeholder="Add a note"
                  maxLength={200}
                  value={form.remarks}
                  onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                />
              </div>

              <TagsField selected={form.tags} onChange={(tags) => setForm((f) => ({ ...f, tags }))} />

              {!isEditing && (
                <label className="flex min-h-[44px] items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.hasReceipt}
                    onChange={(e) => setForm((f) => ({ ...f, hasReceipt: e.target.checked, file: null }))}
                    className="h-4 w-4 rounded border-app-border"
                  />
                  I have a receipt to attach
                </label>
              )}

              {!isEditing && form.hasReceipt && (
                <input
                  key={shakeKey('file')}
                  type="file"
                  aria-label="Receipt file"
                  accept="image/*,.pdf,.csv,.xls,.xlsx"
                  onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] ?? null }))}
                  data-field="file"
                  className={clsx('text-sm', shakeClass('file'))}
                />
              )}
              <FieldError message={fieldErr('file')} />
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
