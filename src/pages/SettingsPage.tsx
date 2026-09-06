import { LogOut } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useCategories, useAccounts } from '@/hooks/useLookupLists'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { NetWorthForm } from '@/components/settings/NetWorthForm'
import { ManagedListEditor } from '@/components/settings/ManagedListEditor'
import { DetectionSettings } from '@/components/settings/DetectionSettings'
import { DangerZone } from '@/components/settings/DangerZone'
import { AvatarPicker } from '@/components/settings/AvatarPicker'
import { CurrencySelector } from '@/components/settings/CurrencySelector'
import { ThemeSettings } from '@/components/settings/ThemeSettings'
import { PersonalDetails } from '@/components/settings/PersonalDetails'
import { EmailSettings } from '@/components/settings/EmailSettings'

export function SettingsPage() {
  const { email, displayName, signOut } = useAuth()
  const { data: categories = [], add: addCategory } = useCategories()
  const { data: accounts = [], add: addAccount } = useAccounts()

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold text-slate-900">Settings</h1>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AvatarPicker />
        <div className="flex flex-col gap-4">
          <EmailSettings />
          <PersonalDetails />
          <CurrencySelector />
          <ThemeSettings />
        </div>
      </div>

      <NetWorthForm />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ManagedListEditor title="Categories" items={categories} onAdd={(name) => addCategory.mutateAsync(name)} />
        <ManagedListEditor title="Accounts" items={accounts} onAdd={(name) => addAccount.mutateAsync(name)} />
      </div>

      <DetectionSettings />

      <Card className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm font-medium text-slate-800">{displayName}</p>
          <p className="text-helper text-slate-500">{email}</p>
        </div>
        <Button variant="secondary" onClick={() => signOut()}>
          <LogOut size={15} /> Sign out
        </Button>
      </Card>

      <DangerZone />
    </div>
  )
}
