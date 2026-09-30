// Loan / EMI progress for a recurring item that has loan details
// (recurring_items.loan_amount / loan_tenure_months / loan_start_date).
//
// "Paid" is counted from the item's schedule, not from logged transactions:
// every installment due before its current next_date counts as paid, because
// "Mark paid" is the only thing that moves next_date forward (a manual edit of
// next_date says the same thing -- "I'm up to here"). That also counts EMIs
// paid before the user started tracking in the app, which a count of logged
// transactions would miss. Month keys are YYYY-MM strings; no Date/UTC maths.

import { shiftMonth } from '@/lib/savings'

export interface LoanDetails {
  /** Amount borrowed (principal). */
  amount: number
  /** Loan tenure in months. */
  tenureMonths: number
  /** YYYY-MM of the first EMI. */
  startMonth: string
  /** Annual interest rate in %, when known. */
  interestRate?: number | null
}

export interface LoanProgress {
  /** Installments paid so far (0..total). */
  paid: number
  /** Installments in the whole loan. */
  total: number
  remaining: number
  /** paid × EMI. */
  paidAmount: number
  /** total × EMI -- what the loan costs in all. */
  totalPayable: number
  /** totalPayable − amount borrowed; 0 when the EMIs don't exceed it. */
  interest: number
  /** YYYY-MM of the last EMI. */
  endMonth: string
  /** Every installment is paid. */
  done: boolean
}

/** Months per installment for each cadence; loans aren't tracked weekly. */
const STEP_MONTHS: Record<string, number | undefined> = {
  monthly: 1,
  quarterly: 3,
  'half-yearly': 6,
  annual: 12,
}

/** Whole months from `from` to `to` (YYYY-MM), negative when `to` is earlier. */
export function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  return (ty - fy) * 12 + (tm - fm)
}

/** Loan cadences that can carry loan details (EMIs are at least monthly apart). */
export function supportsLoanDetails(cadence: string): boolean {
  return STEP_MONTHS[cadence] !== undefined
}

/**
 * Progress of a loan paid by an EMI of `emi` every `cadence`, where
 * `nextDate` (YYYY-MM-DD) is the item's next unpaid due date. Null when the
 * cadence can't carry a loan schedule.
 */
export function loanProgress(loan: LoanDetails, emi: number, cadence: string, nextDate: string): LoanProgress | null {
  const step = STEP_MONTHS[cadence]
  if (!step) return null
  const total = Math.max(1, Math.ceil(loan.tenureMonths / step))
  const due = Math.floor(monthsBetween(loan.startMonth, nextDate.slice(0, 7)) / step)
  const paid = Math.min(total, Math.max(0, due))
  const round2 = (n: number) => Math.round(n * 100) / 100
  const totalPayable = round2(total * emi)
  return {
    paid,
    total,
    remaining: total - paid,
    paidAmount: round2(paid * emi),
    totalPayable,
    interest: Math.max(0, round2(totalPayable - loan.amount)),
    endMonth: shiftMonth(loan.startMonth, (total - 1) * step),
    done: paid >= total,
  }
}

/** The loan details stored on an item, or null when it isn't a loan. */
export function loanDetailsOf(item: {
  loan_amount: number | null
  loan_tenure_months: number | null
  loan_start_date: string | null
  loan_interest_rate?: number | null
}): LoanDetails | null {
  if (item.loan_amount == null || item.loan_tenure_months == null || item.loan_start_date == null) return null
  return {
    amount: Number(item.loan_amount),
    tenureMonths: item.loan_tenure_months,
    startMonth: item.loan_start_date.slice(0, 7),
    interestRate: item.loan_interest_rate != null ? Number(item.loan_interest_rate) : null,
  }
}

/**
 * Standard reducing-balance EMI for `principal` at `annualRatePercent` over
 * `months` monthly installments: P·r·(1+r)^n / ((1+r)^n − 1) with r the
 * monthly rate; a 0% loan is just principal / months. Rounded to the paisa.
 */
export function emiFor(principal: number, annualRatePercent: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0
  const r = annualRatePercent / 12 / 100
  const raw = r === 0 ? principal / months : (principal * r * (1 + r) ** months) / ((1 + r) ** months - 1)
  return Math.round(raw * 100) / 100
}

/** "Oct 2027" for a YYYY-MM key, in the user's locale. */
export function loanMonthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

/**
 * What's still owed on the loan itself (principal) after the installments
 * counted as paid -- on a card EMI, this much of the card's limit stays
 * blocked. With a known rate it's the reducing-balance balance; without one,
 * the unpaid share of the amount borrowed. 0 once it's paid off.
 */
export function outstandingPrincipal(loan: LoanDetails, emi: number, cadence: string, nextDate: string): number {
  const progress = loanProgress(loan, emi, cadence, nextDate)
  if (!progress || progress.done) return 0
  const step = STEP_MONTHS[cadence] ?? 1
  const rate = loan.interestRate ?? 0
  let left: number
  if (rate > 0) {
    const r = (rate / 100 / 12) * step
    const grow = (1 + r) ** progress.paid
    left = loan.amount * grow - (emi * (grow - 1)) / r
  } else {
    left = (loan.amount * progress.remaining) / progress.total
  }
  return Math.max(0, Math.min(loan.amount, Math.round(left * 100) / 100))
}
