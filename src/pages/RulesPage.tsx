import { useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { useRules, type Rule } from '@/hooks/useRules'
import { PageHeader, PageHeaderAction } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { RuleRow } from '@/components/rules/RuleRow'
import { RuleFormModal } from '@/components/rules/RuleFormModal'
import { TagManager } from '@/components/rules/TagManager'

function RulesSkeleton() {
  return (
    <Card className="p-4">
      <ul>
        {Array.from({ length: 4 }).map((_, i) => (
          <li
            key={i}
            className="flex items-center justify-between gap-3 border-b border-app-border py-3 last:border-b-0"
          >
            <Skeleton className="h-3.5 w-2/3" />
            <div className="flex shrink-0 items-center gap-2">
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export function RulesPage() {
  const { data: rules = [], update, remove, isLoading } = useRules()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Rule | null>(null)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Rules"
        actions={
          <PageHeaderAction
            label="New rule"
            onClick={() => {
              setEditing(null)
              setModalOpen(true)
            }}
          />
        }
      />

      {isLoading ? (
        <RulesSkeleton />
      ) : rules.length === 0 ? (
        <EmptyState
          icon={SlidersHorizontal}
          title="No rules yet"
          description="Rules auto-categorize future CSV imports and new entries, e.g. “when merchant contains starbucks, then category: Dining”."
        />
      ) : (
        <Card className="p-4">
          <ul className="stagger-rows">
            {rules.map((rule) => (
              <RuleRow
                key={rule.id}
                rule={rule}
                onToggle={() => update.mutate({ id: rule.id, enabled: !rule.enabled })}
                onEdit={() => {
                  setEditing(rule)
                  setModalOpen(true)
                }}
                onDelete={() => remove.mutate(rule.id)}
              />
            ))}
          </ul>
        </Card>
      )}

      <TagManager />

      <RuleFormModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} />
    </div>
  )
}
