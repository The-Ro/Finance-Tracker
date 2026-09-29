import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Archive, ChevronDown, CreditCard, Plus } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal, SheetDeleteButton, SheetSaveButton } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { AccountKindIcon, DebitCardIcon } from '@/components/ui/AccountKindIcon'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useAccountDetails, useAccountOpeningBalances, useAccounts, useAddAccount } from '@/hooks/useLookupLists'
import { useAccountBalances, useMyTransactions } from '@/hooks/useTransactions'
import { useAccountKinds, useCardStatuses } from '@/hooks/useCards'
import { useDebitCards, useRemoveDebitCard, type ConvertResult } from '@/hooks/useDebitCards'
import { useAccountsInUse } from '@/hooks/useAccountsInUse'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { ACCOUNT_KIND_LABELS } from '@/lib/creditCards'
import { debitCardLabel, debitCardsByAccount, looksLikeDebitCardAccount, type DebitCard } from '@/lib/debitCards'
import { groupAccounts } from '@/lib/accountGroups'
import { formatShortDate } from '@/lib/format'
import { AccountForm } from './AccountForm'
import { AddAccountFlow, type AddAccountResult } from './AddAccountFlow'
import { DebitCardForm } from './DebitCardForm'
import { ConvertDebitCardForm } from './ConvertDebitCardForm'
import { AccountRow, AccountsSectionCard, EmptyRows, RowList, RowValue } from './AccountRows'
import { permanentCashAccount, type AddAccountType } from './addAccount'
import { friendlyAccountError } from './accountErrors'

type Sheet =
  | { type: 'add'; addType?: AddAccountType }
  | { type: 'edit-account'; account: string }
  | { type: 'debit'; card?: DebitCard; defaultAccount?: string }
  | { type: 'convert'; account: string }

type Removal = { type: 'account'; name: string } | { type: 'debit'; card: DebitCard }

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/**
 * Settings → Accounts & cards. Savings/current accounts, debit cards, credit
 * cards and cash/wallets are separate sections; a debit card draws from the
 * savings/current account it's linked to. Adding asks the type first
 * (AddAccountFlow); Cash is always there and can't be closed or removed.
 * Seeded banks nobody uses stay out of the lists (never deleted) and can be
 * picked when adding an account. Closed accounts (and the debit cards on them)
 * keep their history but move to a collapsed "Closed" group, out of pickers,
 * totals and bills.
 */
export function AccountsManager() {
  const { userId } = useAuth()
  const { data: accounts = [], remove: removeAccount } = useAccounts()
  const { data: detailsMap } = useAccountDetails()
  const { data: openings } = useAccountOpeningBalances()
  const kinds = useAccountKinds()
  const balances = useAccountBalances(userId)
  const cardStatuses = useCardStatuses()
  const { data: transactions = [] } = useMyTransactions(userId)
  const { data: debitCards = [] } = useDebitCards()
  const removeCard = useRemoveDebitCard()
  const addAccount = useAddAccount()
  const { inUse, ready } = useAccountsInUse()
  const { format, formatCompact } = useFormatCurrency()
  const { show } = useToast()

  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [removal, setRemoval] = useState<Removal | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [showClosed, setShowClosed] = useState(false)

  const closedSet = useMemo(() => new Set(accounts.filter((n) => detailsMap?.get(n)?.closed)), [accounts, detailsMap])
  const visible = useMemo(() => accounts.filter((n) => inUse.has(n) && !closedSet.has(n)), [accounts, inUse, closedSet])
  const groups = useMemo(() => groupAccounts(visible, kinds), [visible, kinds])
  const cardsByAccount = useMemo(() => debitCardsByAccount(debitCards), [debitCards])
  const openCards = useMemo(() => debitCards.filter((c) => !closedSet.has(c.account)), [debitCards, closedSet])
  const closedCards = useMemo(() => debitCards.filter((c) => closedSet.has(c.account)), [debitCards, closedSet])
  const closedAccounts = useMemo(() => accounts.filter((n) => closedSet.has(n)).sort((a, b) => a.localeCompare(b)), [accounts, closedSet])
  const legacy = useMemo(() => visible.filter((n) => looksLikeDebitCardAccount(n)), [visible])
  const closedCount = closedAccounts.length + closedCards.length
  const cashAccount = useMemo(() => permanentCashAccount(accounts, kinds), [accounts, kinds])
  // The always-kept cash account leads its section.
  const cashWallet = useMemo(
    () => [...groups.cashWallet].sort((a, b) => Number(b === cashAccount) - Number(a === cashAccount)),
    [groups.cashWallet, cashAccount]
  )

  const balanceOf = (name: string) => balances.get(name) ?? openings?.get(name) ?? 0
  const txCount = (name: string) => transactions.filter((t) => t.account === name || t.to_account === name).length

  const closeSheet = () => setSheet(null)

  const requestRemoval = (r: Removal) => {
    setSheet(null)
    setRemoval(r)
  }

  const confirmRemoval = async () => {
    if (!removal) return
    try {
      if (removal.type === 'account') {
        await removeAccount.mutateAsync(removal.name)
        show(`Removed ${removal.name}`)
      } else {
        await removeCard.mutateAsync(removal.card.id)
        show(`Removed ${removal.card.name}`)
      }
      setRemoval(null)
    } catch (e) {
      setRemoval(null)
      show(friendlyAccountError(e, 'Could not remove it.'), { tone: 'error' })
    }
  }

  const onClosedChange = (name: string, closed: boolean) => {
    setSheet(null)
    show(closed ? `${name} closed. Its history stays; it's hidden from new entries, totals and bills.` : `${name} reopened.`)
  }

  const onAdded = (r: AddAccountResult) => {
    setSheet(null)
    if (r.debitCardError) {
      show(`Added ${r.name}, but its debit card couldn’t be added: ${r.debitCardError} Add it under Debit cards.`, { tone: 'error' })
    } else {
      show(r.debitCard ? `Added ${r.name} and ${r.debitCard}` : `Added ${r.name}`)
    }
  }

  const restoreCash = async () => {
    try {
      await addAccount.mutateAsync({ name: 'Cash', details: { kind: 'cash', creditLimit: null, statementDay: null, dueDay: null } })
      show('Cash is back')
    } catch (e) {
      show(friendlyAccountError(e, 'Could not add Cash.'), { tone: 'error' })
    }
  }

  const onConverted = (r: ConvertResult & { account: string; linkedAccount: string }) => {
    setSheet(null)
    const removed = r.removedTransfers > 0 ? ` and removed ${plural(r.removedTransfers, 'transfer')} between them` : ''
    setNotice(`${r.account} is now a debit card on ${r.linkedAccount}. Moved ${plural(r.moved, 'transaction')}${removed}.`)
  }

  const sheetTitle = !sheet
    ? ''
    : sheet.type === 'add'
      ? 'Add an account'
      : sheet.type === 'edit-account'
        ? sheet.account
        : sheet.type === 'debit'
          ? sheet.card
            ? sheet.card.name
            : 'Add a debit card'
          : `Convert ${sheet.account}`

  if (!ready) {
    return (
      <Card className="flex flex-col gap-3 p-5" aria-busy="true">
        <Skeleton className="h-4 w-48 rounded" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </Card>
    )
  }

  const bankValue = (name: string) => {
    const b = balanceOf(name)
    return <RowValue tone={b < 0 ? 'danger' : 'default'}>{format(b)}</RowValue>
  }

  return (
    <div className="flex flex-col gap-4">
      <Button onClick={() => setSheet({ type: 'add' })} className="w-full gap-2 sm:w-auto sm:self-end">
        <Plus size={16} aria-hidden="true" />
        Add account
      </Button>

      {notice && <InlineMessage tone="success">{notice}</InlineMessage>}

      {legacy.map((name) => (
        <Card key={name} className="flex flex-col gap-3 border-caution/40 bg-caution-light p-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-app-card text-caution">
              <CreditCard size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">{name} looks like a debit card</p>
              <p className="text-helper text-slate-600">
                It’s set up as a separate {ACCOUNT_KIND_LABELS[kinds.get(name) ?? 'savings'].toLowerCase()}, so spending with it
                doesn’t come out of your bank balance.
              </p>
            </div>
          </div>
          <Button variant="secondary" className="shrink-0" onClick={() => setSheet({ type: 'convert', account: name })}>
            Convert to a debit card
          </Button>
        </Card>
      ))}

      <AccountsSectionCard
        id="starting-balances"
        title="Savings & current accounts"
        description="What’s in each account today. Debit cards spend from these."
        addLabel="Add a bank account"
        onAdd={() => setSheet({ type: 'add', addType: 'bank' })}
      >
        {groups.bank.length === 0 ? (
          <EmptyRows>No bank accounts yet. Add the ones you use.</EmptyRows>
        ) : (
          <RowList>
            {groups.bank.map((name) => {
              const kind = kinds.get(name) ?? 'savings'
              const cards = cardsByAccount.get(name)?.length ?? 0
              return (
                <AccountRow
                  key={name}
                  icon={<AccountKindIcon kind={kind} size={18} />}
                  name={name}
                  subline={`${kind === 'current' ? 'Current' : 'Savings'}${cards ? ` · ${plural(cards, 'debit card')}` : ''}`}
                  value={bankValue(name)}
                  ariaLabel={`${name}, ${ACCOUNT_KIND_LABELS[kind].toLowerCase()}, balance ${format(balanceOf(name))}`}
                  onClick={() => setSheet({ type: 'edit-account', account: name })}
                />
              )
            })}
          </RowList>
        )}
      </AccountsSectionCard>

      <AccountsSectionCard
        id="debit-cards"
        title="Debit cards"
        description="Purchases come out of the account each card is linked to."
        addLabel="Add a debit card"
        onAdd={() => setSheet({ type: 'debit' })}
      >
        {openCards.length === 0 ? (
          <EmptyRows>No debit cards yet. Add one to pick it when you log a purchase.</EmptyRows>
        ) : (
          <RowList>
            {openCards.map((card) => (
              <AccountRow
                key={card.id}
                icon={<DebitCardIcon size={18} />}
                name={card.name}
                subline={`${card.last4 ? `••${card.last4} · ` : ''}from ${card.account}`}
                ariaLabel={`${debitCardLabel(card)}, spends from ${card.account}`}
                onClick={() => setSheet({ type: 'debit', card })}
              />
            ))}
          </RowList>
        )}
      </AccountsSectionCard>

      <AccountsSectionCard
        id="account-types"
        title="Credit cards"
        description="Money you owe. Paying the bill is a transfer from your bank."
        addLabel="Add a credit card"
        onAdd={() => setSheet({ type: 'add', addType: 'credit' })}
      >
        {groups.credit.length === 0 ? (
          <EmptyRows>No credit cards yet.</EmptyRows>
        ) : (
          <RowList>
            {groups.credit.map((name) => {
              const status = cardStatuses.get(name)
              const d = detailsMap?.get(name)
              const parts: string[] = []
              if (status?.available != null) parts.push(`${formatCompact(status.available)} available`)
              if (status?.bill && status.bill.due > 0) parts.push(`${formatCompact(status.bill.due)} due ${formatShortDate(status.bill.dueDate)}`)
              if (parts.length === 0) parts.push(d?.statementDay ? 'No bill due' : 'Add a limit and bill dates')
              const owed = status?.owed ?? 0
              const credit = status?.credit ?? 0
              return (
                <AccountRow
                  key={name}
                  icon={<AccountKindIcon kind="credit_card" size={18} />}
                  name={name}
                  subline={parts.join(' · ')}
                  value={
                    owed > 0 ? (
                      <span className="flex shrink-0 flex-col items-end">
                        <RowValue tone="danger">{format(owed)}</RowValue>
                        <span className="text-xs leading-tight text-slate-500">owed</span>
                      </span>
                    ) : credit > 0 ? (
                      <RowValue tone="positive">{`${format(credit)} credit`}</RowValue>
                    ) : (
                      <RowValue tone="muted">Nothing owed</RowValue>
                    )
                  }
                  ariaLabel={`${name}, credit card, ${owed > 0 ? `${format(owed)} owed` : 'nothing owed'}`}
                  onClick={() => setSheet({ type: 'edit-account', account: name })}
                />
              )
            })}
          </RowList>
        )}
      </AccountsSectionCard>

      <AccountsSectionCard
        id="cash-wallets"
        title="Cash & wallets"
        description="Cash in hand is always here. Add wallets like Paytm."
        addLabel="Add a wallet"
        onAdd={() => setSheet({ type: 'add', addType: 'wallet' })}
      >
        <RowList>
          {!cashAccount && (
            <AccountRow
              icon={<AccountKindIcon kind="cash" size={18} />}
              name="Cash"
              subline={addAccount.isPending ? 'Adding…' : 'Missing — tap to add it back'}
              ariaLabel="Add Cash back"
              onClick={() => void restoreCash()}
            />
          )}
          {cashWallet.map((name) => {
            const kind = kinds.get(name) ?? 'cash'
            const always = name === cashAccount
            return (
              <AccountRow
                key={name}
                icon={<AccountKindIcon kind={kind} size={18} />}
                name={name}
                subline={always ? 'Cash in hand · Always here' : kind === 'cash' ? 'Cash in hand' : ACCOUNT_KIND_LABELS[kind]}
                value={bankValue(name)}
                ariaLabel={`${name}, ${ACCOUNT_KIND_LABELS[kind].toLowerCase()}, balance ${format(balanceOf(name))}${always ? ', always here' : ''}`}
                onClick={() => setSheet({ type: 'edit-account', account: name })}
              />
            )
          })}
        </RowList>
      </AccountsSectionCard>

      {closedCount > 0 && (
        <Card id="closed-accounts" className="scroll-mt-24 p-5">
          <button
            type="button"
            onClick={() => setShowClosed((v) => !v)}
            aria-expanded={showClosed}
            aria-controls="closed-accounts-list"
            className="-m-2 flex min-h-[44px] w-[calc(100%+1rem)] items-center gap-3 rounded-xl p-2 text-left hover:bg-slate-50"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <Archive size={18} aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-semibold text-slate-800">Closed accounts</span>
              <span className="text-helper text-slate-500">
                {plural(closedCount, 'item')} · history kept, hidden from entries, totals and bills
              </span>
            </span>
            <ChevronDown
              size={18}
              aria-hidden="true"
              className={clsx('shrink-0 text-slate-400 transition-transform', showClosed && 'rotate-180')}
            />
          </button>
          {showClosed && (
            <div id="closed-accounts-list" className="animate-fade-in-up mt-3">
              <RowList>
                {closedAccounts.map((name) => {
                  const kind = kinds.get(name) ?? 'savings'
                  return (
                    <AccountRow
                      key={name}
                      closed
                      icon={<AccountKindIcon kind={kind} size={18} />}
                      name={name}
                      subline={ACCOUNT_KIND_LABELS[kind]}
                      ariaLabel={`${name}, closed ${ACCOUNT_KIND_LABELS[kind].toLowerCase()}`}
                      onClick={() => setSheet({ type: 'edit-account', account: name })}
                    />
                  )
                })}
                {closedCards.map((card) => (
                  <AccountRow
                    key={card.id}
                    closed
                    icon={<DebitCardIcon size={18} />}
                    name={card.name}
                    subline={`${card.last4 ? `••${card.last4} · ` : ''}closed with ${card.account}`}
                    ariaLabel={`${debitCardLabel(card)}, closed with ${card.account}`}
                    onClick={() => setSheet({ type: 'debit', card })}
                  />
                ))}
              </RowList>
            </div>
          )}
        </Card>
      )}

      <Modal
        open={sheet !== null}
        onClose={closeSheet}
        title={sheetTitle}
        headerActions={
          sheet?.type === 'edit-account' ? (
            <>
              {sheet.account !== cashAccount && (
                <SheetDeleteButton
                  label={`Remove ${sheet.account}`}
                  onClick={() => requestRemoval({ type: 'account', name: sheet.account })}
                />
              )}
              <SheetSaveButton form="account-sheet-form" />
            </>
          ) : sheet?.type === 'debit' ? (
            <>
              {sheet.card && (
                <SheetDeleteButton label={`Remove ${sheet.card.name}`} onClick={() => requestRemoval({ type: 'debit', card: sheet.card! })} />
              )}
              <SheetSaveButton form="debit-sheet-form" label={sheet.card ? 'Save' : 'Add card'} />
            </>
          ) : null
        }
      >
        {sheet?.type === 'add' && (
          <AddAccountFlow
            key={`add-${sheet.addType ?? 'any'}`}
            idPrefix="settings-add"
            initialType={sheet.addType}
            onDone={onAdded}
            onCancel={closeSheet}
          />
        )}
        {sheet?.type === 'edit-account' && (
          <AccountForm
            key={`edit-${sheet.account}`}
            idPrefix="settings-account"
            account={sheet.account}
            permanent={sheet.account === cashAccount}
            formId="account-sheet-form"
            hideActions
            onSaved={(name) => {
              closeSheet()
              show(`Saved ${name}`)
            }}
            onCancel={closeSheet}
            onRemove={() => requestRemoval({ type: 'account', name: sheet.account })}
            onClosedChange={onClosedChange}
          />
        )}
        {sheet?.type === 'debit' && (
          <DebitCardForm
            key={sheet.card?.id ?? 'new'}
            idPrefix="settings-debit"
            card={sheet.card}
            bankAccounts={groups.bank}
            defaultAccount={sheet.defaultAccount}
            formId="debit-sheet-form"
            hideActions
            onSaved={(name) => {
              closeSheet()
              show(sheet.card ? `Saved ${name}` : `Added ${name}`)
            }}
            onCancel={closeSheet}
            onRemove={sheet.card ? () => requestRemoval({ type: 'debit', card: sheet.card! }) : undefined}
          />
        )}
        {sheet?.type === 'convert' && (
          <ConvertDebitCardForm
            key={sheet.account}
            account={sheet.account}
            bankAccounts={groups.bank}
            transactionCount={txCount(sheet.account)}
            onDone={onConverted}
            onCancel={closeSheet}
          />
        )}
      </Modal>

      <ConfirmDeleteModal
        open={removal !== null}
        title={removal?.type === 'debit' ? `Remove ${removal.card.name}?` : `Remove ${removal?.name ?? ''}?`}
        confirmLabel="Remove"
        pending={removeAccount.isPending || removeCard.isPending}
        onCancel={() => setRemoval(null)}
        onConfirm={confirmRemoval}
      >
        {removal?.type === 'debit' ? (
          <p>Its past purchases stay on {removal.card.account} — they just won’t show this card any more.</p>
        ) : removal ? (
          <p>
            Only an account with no transactions or recurring payments can be removed.
            {(cardsByAccount.get(removal.name)?.length ?? 0) > 0 && ' Its debit cards are removed too.'}
          </p>
        ) : null}
      </ConfirmDeleteModal>
    </div>
  )
}
