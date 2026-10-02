import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { ZodiacSign } from '@/types/database.types'

/** The fun facts for one star sign (zodiac_facts: our own list, no outside API). */
export function useZodiacFacts(sign: ZodiacSign | null) {
  return useQuery({
    queryKey: ['zodiac_facts', sign],
    enabled: !!sign,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.from('zodiac_facts').select('fact').eq('sign', sign!)
      if (error) throw error
      return (data ?? []).map((r) => r.fact as string)
    },
  })
}
