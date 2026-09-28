// Which icon a transaction's category gets in Activity (instead of the
// merchant's first letter). Built-in categories map directly; anything else --
// categories users made themselves -- is matched by keyword, then falls back
// to a plain tag. Pure (returns a key), so it's testable without React; the
// key -> icon component map lives in components/ui/CategoryIcon.tsx.

export type CategoryIconKey =
  | 'home' | 'bolt' | 'basket' | 'dining' | 'car' | 'bag' | 'health' | 'shield' | 'film' | 'repeat'
  | 'education' | 'plane' | 'sparkles' | 'gift' | 'receipt' | 'salary' | 'laptop' | 'percent' | 'trending'
  | 'building' | 'award' | 'refund' | 'wallet' | 'review' | 'transfer' | 'loan' | 'fuel' | 'phone' | 'wifi'
  | 'coffee' | 'pet' | 'baby' | 'fitness' | 'tag'

const BUILT_IN: Record<string, CategoryIconKey> = {
  housing: 'home',
  utilities: 'bolt',
  groceries: 'basket',
  dining: 'dining',
  transportation: 'car',
  shopping: 'bag',
  health: 'health',
  insurance: 'shield',
  entertainment: 'film',
  subscriptions: 'repeat',
  education: 'education',
  travel: 'plane',
  'personal care': 'sparkles',
  'gifts & donations': 'gift',
  'fees & charges': 'receipt',
  other: 'tag',
  salary: 'salary',
  'freelance / business': 'laptop',
  interest: 'percent',
  dividends: 'trending',
  'rental income': 'building',
  bonus: 'award',
  'refund / reimbursement': 'refund',
  'gift received': 'gift',
  'other income': 'wallet',
  'needs review': 'review',
}

/** Keyword -> icon for custom categories, checked in order (first match wins). */
const KEYWORDS: [RegExp, CategoryIconKey][] = [
  [/\b(loan|emi|mortgage|credit)\b/, 'loan'],
  [/(invest|sip|mutual|stock|share|fund|crypto|gold)/, 'trending'],
  [/(fuel|petrol|diesel|gas station|ev charg)/, 'fuel'],
  [/(mobile|phone|recharge|postpaid|prepaid)/, 'phone'],
  [/(internet|wifi|wi-fi|broadband|fiber|fibre)/, 'wifi'],
  [/(rent|house|home|maintenance)/, 'home'],
  [/(electric|power|water|utility|bill)/, 'bolt'],
  [/(medical|medicine|doctor|hospital|pharma|health)/, 'health'],
  [/(coffee|cafe|tea|snack)/, 'coffee'],
  [/(food|restaurant|dining|swiggy|zomato|eat)/, 'dining'],
  [/(grocery|groceries|vegetable|supermarket)/, 'basket'],
  [/(cab|taxi|uber|ola|metro|bus|train|transport|parking|toll)/, 'car'],
  [/(flight|travel|trip|holiday|hotel)/, 'plane'],
  [/(school|college|course|tuition|book|education)/, 'education'],
  [/(pet|dog|cat|vet)/, 'pet'],
  [/(kid|child|baby)/, 'baby'],
  [/(gym|fitness|sport|yoga)/, 'fitness'],
  [/(movie|netflix|ott|game|entertain)/, 'film'],
  [/(subscription|membership)/, 'repeat'],
  [/(gift|donation|charity)/, 'gift'],
  [/(insurance|policy|premium)/, 'shield'],
  [/(shop|cloth|amazon|flipkart|myntra)/, 'bag'],
  [/(salary|payroll|wage)/, 'salary'],
  [/(tax|fee|charge|fine|penalty)/, 'receipt'],
]

export function categoryIconKey(category: string | null | undefined, type?: string): CategoryIconKey {
  if (type === 'transfer') return 'transfer'
  const name = (category ?? '').trim().toLowerCase()
  if (!name) return 'tag'
  const builtIn = BUILT_IN[name]
  if (builtIn) return builtIn
  for (const [pattern, key] of KEYWORDS) if (pattern.test(name)) return key
  return 'tag'
}
