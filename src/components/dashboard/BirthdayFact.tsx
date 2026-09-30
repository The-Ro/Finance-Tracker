import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { zodiacFor } from '@/lib/home'
import type { ZodiacSign } from '@/types/database.types'

/**
 * A random fun fact about the user's star sign under Home's birthday greeting
 * -- a different one each time (same list as the birthday note, zodiac_facts).
 */
export function BirthdayFact({ dateOfBirth, sign }: { dateOfBirth: string; sign: ZodiacSign | null }) {
  const zodiac = sign ?? zodiacFor(dateOfBirth)
  const { data: facts = [] } = useQuery({
    queryKey: ['zodiac_facts', zodiac],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.from('zodiac_facts').select('fact').eq('sign', zodiac)
      if (error) throw error
      return (data ?? []).map((r) => r.fact as string)
    },
  })
  // Picked once per visit to Home, so it changes from one visit to the next.
  const fact = useMemo(() => (facts.length ? facts[Math.floor(Math.random() * facts.length)] : null), [facts])
  if (!fact) return null
  return (
    <p className="animate-fade-in-up flex items-start gap-1.5 text-sm text-slate-600">
      <Sparkles size={15} className="mt-0.5 shrink-0 text-brass" aria-hidden="true" />
      <span>Fun fact: {fact}</span>
    </p>
  )
}
