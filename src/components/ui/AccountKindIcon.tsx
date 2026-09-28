import { Banknote, Briefcase, CreditCard, Landmark, Wallet, type LucideProps } from 'lucide-react'
import type { AccountKind } from '@/types/database.types'

const ICONS = {
  savings: Landmark,
  current: Briefcase,
  credit_card: CreditCard,
  cash: Banknote,
  wallet: Wallet,
} satisfies Record<AccountKind, unknown>

/** One icon per account kind; debit cards use `DebitCardIcon`. */
export function AccountKindIcon({ kind, ...props }: { kind: AccountKind | undefined } & LucideProps) {
  const Icon = ICONS[kind ?? 'savings']
  return <Icon aria-hidden="true" {...props} />
}

export function DebitCardIcon(props: LucideProps) {
  return <CreditCard aria-hidden="true" {...props} />
}
