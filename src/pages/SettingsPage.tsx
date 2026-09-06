import { useCategories, useAccounts } from '@/hooks/useLookupLists'
import { NetWorthForm } from '@/components/settings/NetWorthForm'
import { ManagedListEditor } from '@/components/settings/ManagedListEditor'
import { DetectionSettings } from '@/components/settings/DetectionSettings'
import { DangerZone } from '@/components/settings/DangerZone'
import { AvatarPicker } from '@/components/settings/AvatarPicker'
import { CurrencySelector } from '@/components/settings/CurrencySelector'
import { ThemeSettings } from '@/components/settings/ThemeSettings'
import { PersonalDetails } from '@/components/settings/PersonalDetails'
import { EmailSettings } from '@/components/settings/EmailSettings'
import { PasswordSettings } from '@/components/settings/PasswordSettings'
import { SharingSettings } from '@/components/settings/SharingSettings'

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {description && <p className="mt-1 text-helper text-slate-400">{description}</p>}
    </div>
  )
}

export function SettingsPage() {
  const { data: categories = [], add: addCategory } = useCategories()
  const { data: accounts = [], add: addAccount } = useAccounts()

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold text-slate-900">Settings</h1>

      <section className="flex flex-col gap-4">
        <SectionHeading title="Profile" description="Your name, avatar, and personal details." />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AvatarPicker />
          <PersonalDetails />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading
          title="Sharing"
          description="Your transactions are private by default. Approve someone here to let them see yours, or request to see someone else's."
        />
        <SharingSettings />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading title="Preferences" description="How Ledgerly looks and formats numbers for you." />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CurrencySelector />
          <ThemeSettings />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading title="Financial setup" description="Net worth, plus your personal categories and accounts." />
        <NetWorthForm />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ManagedListEditor title="Categories" items={categories} onAdd={(name) => addCategory.mutateAsync(name)} />
          <ManagedListEditor title="Accounts" items={accounts} onAdd={(name) => addAccount.mutateAsync(name)} />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading title="Automation" description="Recurring and subscription detection." />
        <DetectionSettings />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading title="Account & security" description="Sign-in details for this account." />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <EmailSettings />
          <PasswordSettings />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading title="Danger zone" />
        <DangerZone />
      </section>
    </div>
  )
}
