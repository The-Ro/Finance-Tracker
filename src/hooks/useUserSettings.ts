import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import { DEFAULT_CURRENCY } from '@/lib/currency'
import { CURRENT_WHATS_NEW_VERSION } from '@/lib/whatsNew'
import type { Gender, SelectedPeriod, ThemeAccent, ThemeMode, ZodiacSign } from '@/types/database.types'

export interface UserSettings {
  assetsTotal: number
  liabilitiesTotal: number
  netWorthConfigured: boolean
  selectedPeriod: SelectedPeriod
  currency: string
  themeMode: ThemeMode
  themeAccent: ThemeAccent
  gender: Gender | null
  dateOfBirth: string | null
  onboardingCompleted: boolean
  interests: string[]
  zodiacSign: ZodiacSign | null
  whatsNewSeenVersion: string | null
}

const DEFAULT_SETTINGS: UserSettings = {
  assetsTotal: 0,
  liabilitiesTotal: 0,
  netWorthConfigured: false,
  selectedPeriod: 'all-time',
  currency: DEFAULT_CURRENCY,
  themeMode: 'system',
  themeAccent: 'violet',
  gender: null,
  dateOfBirth: null,
  onboardingCompleted: false,
  interests: [],
  zodiacSign: null,
  whatsNewSeenVersion: null,
}

export function useUserSettings() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['user_settings', userId],
    enabled: !!userId,
    queryFn: async (): Promise<UserSettings> => {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('owner_user_id', userId!)
        .maybeSingle()
      if (error) throw error
      if (!data) {
        // First-ever load for this user: create the row with empty-start defaults.
        const { error: insertError } = await supabase
          .from('user_settings')
          .insert({ owner_user_id: userId! })
        if (insertError) throw insertError
        return DEFAULT_SETTINGS
      }
      return {
        assetsTotal: Number(data.assets_total),
        liabilitiesTotal: Number(data.liabilities_total),
        netWorthConfigured: data.net_worth_configured,
        selectedPeriod: data.selected_period,
        currency: data.currency,
        themeMode: data.theme_mode,
        themeAccent: data.theme_accent,
        gender: data.gender,
        dateOfBirth: data.date_of_birth,
        onboardingCompleted: data.onboarding_completed,
        interests: data.interests ?? [],
        zodiacSign: data.zodiac_sign,
        whatsNewSeenVersion: data.whats_new_seen_version,
      }
    },
  })

  const updatePeriod = useMutation({
    mutationFn: async (period: SelectedPeriod) => {
      const previous = query.data
      queryClient.setQueryData(['user_settings', userId], (old: UserSettings | undefined) =>
        old ? { ...old, selectedPeriod: period } : old
      )
      const { error } = await supabase
        .from('user_settings')
        .update({ selected_period: period })
        .eq('owner_user_id', userId!)
      if (error) {
        // Restore previous selection on failure per spec.
        queryClient.setQueryData(['user_settings', userId], previous)
        throw error
      }
    },
  })

  const updateNetWorth = useMutation({
    mutationFn: async (input: { assetsTotal: number; liabilitiesTotal: number }) => {
      const { error } = await supabase
        .from('user_settings')
        .update({
          assets_total: input.assetsTotal,
          liabilities_total: input.liabilitiesTotal,
          net_worth_configured: true,
        })
        .eq('owner_user_id', userId!)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user_settings', userId] }),
  })

  const updateCurrency = useMutation({
    mutationFn: async (currency: string) => {
      const { error } = await supabase.from('user_settings').update({ currency }).eq('owner_user_id', userId!)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user_settings', userId] }),
  })

  const updateTheme = useMutation({
    mutationFn: async (input: { themeMode?: ThemeMode; themeAccent?: ThemeAccent }) => {
      const { error } = await supabase
        .from('user_settings')
        .update({
          ...(input.themeMode ? { theme_mode: input.themeMode } : {}),
          ...(input.themeAccent ? { theme_accent: input.themeAccent } : {}),
        })
        .eq('owner_user_id', userId!)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user_settings', userId] }),
  })

  const updatePersonalDetails = useMutation({
    mutationFn: async (input: {
      gender?: Gender | null
      dateOfBirth?: string | null
      interests?: string[]
      zodiacSign?: ZodiacSign | null
    }) => {
      const { error } = await supabase
        .from('user_settings')
        .update({
          ...(input.gender !== undefined ? { gender: input.gender } : {}),
          ...(input.dateOfBirth !== undefined ? { date_of_birth: input.dateOfBirth } : {}),
          ...(input.interests !== undefined ? { interests: input.interests } : {}),
          ...(input.zodiacSign !== undefined ? { zodiac_sign: input.zodiacSign } : {}),
        })
        .eq('owner_user_id', userId!)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user_settings', userId] }),
  })

  const completeOnboarding = useMutation({
    mutationFn: async () => {
      // A brand-new user just got the full welcome tour, so there's nothing
      // "new" left to show them -- mark the changelog seen at the same time.
      const { error } = await supabase
        .from('user_settings')
        .update({ onboarding_completed: true, whats_new_seen_version: CURRENT_WHATS_NEW_VERSION })
        .eq('owner_user_id', userId!)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user_settings', userId] }),
  })

  const markWhatsNewSeen = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('user_settings')
        .update({ whats_new_seen_version: CURRENT_WHATS_NEW_VERSION })
        .eq('owner_user_id', userId!)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user_settings', userId] }),
  })

  return {
    ...query,
    updatePeriod,
    updateNetWorth,
    updateCurrency,
    updateTheme,
    updatePersonalDetails,
    completeOnboarding,
    markWhatsNewSeen,
  }
}
