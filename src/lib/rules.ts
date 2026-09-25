import { merchantContains } from '@/lib/merchant'

export interface SimpleRule {
  whenText: string
  thenText: string
  enabled: boolean
}

export interface RuleAction {
  category?: string
  addTags?: string[]
}

/**
 * Parses a rule's "then" text into a concrete action. Supports:
 *   "category: Dining, tag: work-lunch, tag: reimbursable"
 * or a bare category name: "Dining"
 */
function parseThenText(thenText: string): RuleAction {
  const action: RuleAction = {}
  const parts = thenText.split(',').map((p) => p.trim()).filter(Boolean)

  if (parts.length === 0) return action

  const looksStructured = parts.some((p) => /^(category|tag)\s*:/i.test(p))

  if (!looksStructured) {
    action.category = thenText.trim()
    return action
  }

  const tags: string[] = []
  for (const part of parts) {
    const match = part.match(/^(category|tag)\s*:\s*(.+)$/i)
    if (!match) continue
    const [, kind, value] = match
    if (kind.toLowerCase() === 'category') {
      action.category = value.trim()
    } else {
      tags.push(value.trim())
    }
  }
  if (tags.length > 0) action.addTags = tags

  return action
}

/**
 * Applies the first matching enabled rule (merchant contains whenText -- plain
 * case-insensitive, or after normalizing both sides via merchantContains)
 * to a merchant/category/tags triple. Only called for rows still at the default
 * category ("Needs review") so it never silently overrides a user's explicit choice.
 */
export function applyRules(
  merchant: string,
  currentCategory: string,
  currentTags: string[],
  rules: SimpleRule[]
): { category: string; tags: string[] } {
  const match = rules.find((r) => r.enabled && merchantContains(merchant, r.whenText))

  if (!match) return { category: currentCategory, tags: currentTags }

  const action = parseThenText(match.thenText)
  const category = action.category || currentCategory
  const tags = action.addTags
    ? Array.from(new Set([...currentTags, ...action.addTags.map((t) => t.toLowerCase())]))
    : currentTags

  return { category, tags }
}
