import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useCategories, useAccounts } from '@/hooks/useLookupLists'
import { PageHeader } from '@/components/ui/PageHeader'
import { NetWorthForm } from '@/components/settings/NetWorthForm'
import { StartingBalances } from '@/components/settings/StartingBalances'
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
import { FeedbackForm } from '@/components/settings/FeedbackForm'
import { AboutSection } from '@/components/settings/AboutSection'

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h2 className="font-serif text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {description && <p className="mt-1 text-helper text-slate-400">{description}</p>}
    </div>
  )
}

export function SettingsPage() {
  const { expense: expenseCategories, income: incomeCategories, add: addCategory, remove: removeCategory } = useCategories()
  const { data: accounts = [], add: addAccount, remove: removeAccount } = useAccounts()
  const location = useLocation()

  useEffect(() => {
    if (!location.hash) return
    const id = location.hash.slice(1)
    const scroll = () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // Each section fetches its own data independently, so the page is still
    // growing taller as things above the target load in -- one scroll at
    // mount time lands short. Retry a couple of times as that settles.
    scroll()
    const retries = [150, 400, 800, 1400, 2200, 3200].map((delay) => setTimeout(scroll, delay))
    return () => retries.forEach(clearTimeout)
  }, [location.hash])

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Settings" />

      <section className="flex flex-col gap-4">
        <SectionHeading title="Profile" description="Your name, avatar, and personal details." />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AvatarPicker />
          <PersonalDetails />
        </div>
      </section>

      <section id="sharing" className="flex scroll-mt-24 flex-col gap-4">
        <SectionHeading
          title="Sharing"
          description="Your transactions are private by default. Approve someone here to let them see yours, or request to see someone else's."
        />
        <SharingSettings />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading title="Preferences" description="How LedgeEaze looks and formats numbers for you." />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CurrencySelector />
          <ThemeSettings />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading title="Financial setup" description="Net worth, starting balances, and your personal categories and accounts." />
        <div id="net-worth" className="scroll-mt-24">
          <NetWorthForm />
        </div>
        <div id="starting-balances" className="scroll-mt-24">
          <StartingBalances />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ManagedListEditor
            title="Expense categories"
            items={expenseCategories}
            onAdd={(name) => addCategory.mutateAsync({ name, kind: 'expense' })}
            onRemove={(name) => removeCategory.mutateAsync(name)}
          />
          <ManagedListEditor
            title="Income categories"
            items={incomeCategories}
            onAdd={(name) => addCategory.mutateAsync({ name, kind: 'income' })}
            onRemove={(name) => removeCategory.mutateAsync(name)}
          />
        </div>
        <ManagedListEditor
          title="Accounts"
          items={accounts}
          onAdd={(name) => addAccount.mutateAsync(name)}
          onRemove={(name) => removeAccount.mutateAsync(name)}
        />
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

      <section id="feedback" className="flex scroll-mt-24 flex-col gap-4">
        <SectionHeading title="Feedback" description="Bugs, requests, anything -- goes straight to us." />
        <FeedbackForm />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading title="Danger zone" />
        <DangerZone />
      </section>

      <AboutSection />
    </div>
  )
}
