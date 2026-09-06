import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'

const AVATARS_BUCKET = 'avatars'
const MAX_AVATAR_BYTES = 5 * 1024 * 1024

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

/** Uploads a custom profile photo and returns its public URL for saving on the profile. */
export function useUploadAvatar() {
  const { userId } = useAuth()

  return useMutation({
    mutationFn: async (file: File): Promise<string> => {
      if (!file.type.startsWith('image/')) {
        throw new Error('Please choose an image file.')
      }
      if (file.size > MAX_AVATAR_BYTES) {
        throw new Error('That image is larger than 5 MB.')
      }

      const path = `${userId}/${crypto.randomUUID()}-${safeFilename(file.name)}`
      const { error: uploadError } = await supabase.storage
        .from(AVATARS_BUCKET)
        .upload(path, file, { upsert: true })
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path)
      return data.publicUrl
    },
  })
}
