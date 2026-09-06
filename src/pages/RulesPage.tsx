import { useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { useRules, type Rule } from '@/hooks/useRules'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { RuleRow } from '@/components/rules/RuleRow'
import { RuleFormModal } from '@/components/rules/RuleFormModal'
import { TagManager } from '@/components/rules/TagManager'

export function RulesPage() {
  const { data: rules = [], update, remove } = useRules()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Rule | null>(null)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Rules</h1>
        <Button
          onClick={() => {
            setEditing(null)
            setModalOpen(true)
          }}
        >
          Create rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <EmptyState
          icon={SlidersHorizontal}
          title="No rules yet"
          description="Rules auto-categorize future CSV imports and new entries, e.g. “when merchant contains starbucks, then category: Dining”."
        />
      ) : (
        <Card className="p-4">
          <ul>
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
