import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  BellRing,
  ChevronRight,
  Coins,
  Info,
  Landmark,
  MessageSquare,
  Palette,
  Scale,
  Smile,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  TriangleAlert,
  UserRound,
  Users,
  WandSparkles,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useCategories } from '@/hooks/useLookupLists'
import { NetWorthForm } from '@/components/settings/NetWorthForm'
import { ManagedListEditor } from '@/components/settings/ManagedListEditor'
import { MoveCategoryEntries } from './MoveCategoryEntries'
import { CategoryIconPicker } from './CategoryIconPicker'
import { CategoryIcon, CategoryIconByKey } from '@/components/ui/CategoryIcon'
import type { CategoryIconKey } from '@/lib/categoryIcon'
import { SalarySettings } from './SalarySettings'
import { ReminderSettings } from './ReminderSettings'
import { DetectionSettings } from '@/components/settings/DetectionSettings'
import { DangerZone } from '@/components/settings/DangerZone'
import { AvatarPicker } from '@/components/settings/AvatarPicker'
import { CurrencySelector } from '@/components/settings/CurrencySelector'
import { ThemeSettings } from '@/components/settings/ThemeSettings'
import { PersonalDetails } from '@/components/settings/PersonalDetails'
import { EmailSettings } from '@/components/settings/EmailSettings'
import { PasswordSettings } from '@/components/settings/PasswordSettings'
import { SharingSettings } from '@/components/settings/SharingSettings'
import { FeedbackForm } from '@/components/settings/FeedbackForm'
import { AboutSection } from '@/components/settings/AboutSection'
import { AccountsManager } from '@/components/accounts/AccountsManager'

export type SettingsGroupId = 'account' | 'money' | 'app' | 'people' | 'support' | 'danger'

export interface SettingsSection {
  id: string
  label: string
  subtitle: string
  icon: LucideIcon
  group: SettingsGroupId
  render: () => ReactNode
}

export const SETTINGS_GROUPS: { id: SettingsGroupId; label: string }[] = [
  { id: 'account', label: 'Account' },
  { id: 'money', label: 'Money setup' },
  { id: 'app', label: 'App' },
  { id: 'people', label: 'People' },
  { id: 'support', label: 'Support' },
  { id: 'danger', label: 'Danger zone' },
]

/**
 * Expense and income categories, each chip with its icon: tap the icon to
 * change it; a new category can get one before it's added (none picked = the
 * app guesses from the name). Then Move entries.
 */
function CategoriesSection() {
  const { expense, income, icons, add, remove, setIcon } = useCategories()
  const [picker, setPicker] = useState<{ kind: 'expense' | 'income'; name: string | null } | null>(null)
  const [newIcon, setNewIcon] = useState<Record<'expense' | 'income', CategoryIconKey | null>>({ expense: null, income: null })

  const renderIcon = (kind: 'expense' | 'income') => (name: string) => (
    <CategoryIcon category={name} type={kind} iconKey={icons.get(name)} size={15} />
  )
  const addPrefix = (kind: 'expense' | 'income') => (
    <button
      type="button"
      aria-label="Icon for the new category"
      title="Icon for the new category"
      onClick={() => setPicker({ kind, name: null })}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-dashed border-app-border text-slate-500 hover:border-accent hover:text-accent-dark"
    >
      {newIcon[kind] ? <CategoryIconByKey iconKey={newIcon[kind]!} size={18} /> : <Smile size={18} aria-hidden="true" />}
    </button>
  )
  const list = (kind: 'expense' | 'income', title: string, items: string[]) => (
    <ManagedListEditor
      title={title}
      items={items}
      onAdd={async (name) => {
        await add.mutateAsync({ name, kind, icon: newIcon[kind] })
        setNewIcon((v) => ({ ...v, [kind]: null }))
      }}
      onRemove={(name) => remove.mutateAsync(name)}
      renderIcon={renderIcon(kind)}
      onIconClick={(name) => setPicker({ kind, name })}
      addPrefix={addPrefix(kind)}
    />
  )

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {list('expense', 'Expense categories', expense)}
      {list('income', 'Income categories', income)}
      <div className="xl:col-span-2">
        <MoveCategoryEntries />
      </div>
      <CategoryIconPicker
        open={picker !== null}
        title={picker?.name ? `Icon for ${picker.name}` : 'Icon for the new category'}
        value={picker ? (picker.name ? ((icons.get(picker.name) as CategoryIconKey | undefined) ?? null) : newIcon[picker.kind]) : null}
        onClose={() => setPicker(null)}
        onPick={(key) => {
          if (!picker) return
          if (picker.name) setIcon.mutate({ name: picker.name, icon: key })
          else setNewIcon((v) => ({ ...v, [picker.kind]: key }))
          setPicker(null)
        }}
      />
    </div>
  )
}

function RulesLinkCard() {
  return (
    <Link
      to="/rules"
      className="card-interactive flex items-center gap-3 rounded-card border border-app-border bg-app-card p-5 shadow-card"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-light text-accent-on-light">
        <SlidersHorizontal size={18} aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-semibold text-slate-800">Rules</span>
        <span className="text-helper text-slate-500">Set a category automatically when a merchant matches.</span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
    </Link>
  )
}

const twoUp = (a: ReactNode, b: ReactNode) => <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{a}{b}</div>

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: 'profile',
    label: 'Profile',
    subtitle: 'Name, photo and personal details',
    icon: UserRound,
    group: 'account',
    render: () => twoUp(<AvatarPicker />, <PersonalDetails />),
  },
  {
    id: 'security',
    label: 'Sign-in & security',
    subtitle: 'Email address and password',
    icon: ShieldCheck,
    group: 'account',
    render: () => twoUp(<EmailSettings />, <PasswordSettings />),
  },
  {
    id: 'accounts',
    label: 'Accounts & cards',
    subtitle: 'Banks, cards, cash and wallets',
    icon: Landmark,
    group: 'money',
    render: () => <AccountsManager />,
  },
  {
    id: 'categories',
    label: 'Categories',
    subtitle: 'Expense and income categories',
    icon: Tags,
    group: 'money',
    render: () => <CategoriesSection />,
  },
  {
    id: 'salary',
    label: 'Salary',
    subtitle: 'Amount, account and pay day',
    icon: Wallet,
    group: 'money',
    render: () => <SalarySettings />,
  },
  {
    id: 'net-worth',
    label: 'Net worth',
    subtitle: 'What you own minus what you owe',
    icon: Scale,
    group: 'money',
    render: () => <NetWorthForm />,
  },
  {
    id: 'appearance',
    label: 'Appearance',
    subtitle: 'Dark mode and accent theme',
    icon: Palette,
    group: 'app',
    render: () => <ThemeSettings />,
  },
  {
    id: 'currency',
    label: 'Currency',
    subtitle: 'Your home currency',
    icon: Coins,
    group: 'app',
    render: () => <CurrencySelector />,
  },
  {
    id: 'reminders',
    label: 'Reminders',
    subtitle: 'Notes on your phone for bills and money due',
    icon: BellRing,
    group: 'app',
    render: () => <ReminderSettings />,
  },
  {
    id: 'automation',
    label: 'Automation',
    subtitle: 'Repeat payments and rules',
    icon: WandSparkles,
    group: 'app',
    render: () => (
      <>
        <DetectionSettings />
        <RulesLinkCard />
      </>
    ),
  },
  {
    id: 'sharing',
    label: 'Sharing',
    subtitle: 'Who can see your transactions',
    icon: Users,
    group: 'people',
    render: () => <SharingSettings />,
  },
  {
    id: 'feedback',
    label: 'Feedback',
    subtitle: 'Report a bug or ask for a feature',
    icon: MessageSquare,
    group: 'support',
    render: () => <FeedbackForm />,
  },
  {
    id: 'about',
    label: 'About',
    subtitle: "Version and what's new",
    icon: Info,
    group: 'support',
    render: () => <AboutSection />,
  },
  {
    id: 'danger',
    label: 'Danger zone',
    subtitle: 'Erase data or delete account',
    icon: TriangleAlert,
    group: 'danger',
    render: () => <DangerZone />,
  },
]

export function findSettingsSection(id: string | undefined): SettingsSection | undefined {
  return SETTINGS_SECTIONS.find((s) => s.id === id)
}

export function sectionsInGroup(group: SettingsGroupId): SettingsSection[] {
  return SETTINGS_SECTIONS.filter((s) => s.group === group)
}

/** Old single-page anchors (`/settings#net-worth`), kept working for bookmarks. */
export const LEGACY_SETTINGS_HASHES: Record<string, string> = {
  sharing: 'sharing',
  'net-worth': 'net-worth',
  'starting-balances': 'accounts#starting-balances',
  'account-types': 'accounts#account-types',
  'debit-cards': 'accounts#debit-cards',
  feedback: 'feedback',
}
