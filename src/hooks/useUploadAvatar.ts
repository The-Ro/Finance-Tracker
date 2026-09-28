import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import { AVATARS_BUCKET, listFolderFiles, removeFiles } from '@/lib/storageFiles'

const MAX_AVATAR_BYTES = 5 * 1024 * 1024

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

/** Storage path of an uploaded avatar from its public URL; null for a preset avatar key. */
function uploadedAvatarPath(avatar: string | null | undefined): string | null {
  const marker = `/object/public/${AVATARS_BUCKET}/`
  const at = avatar?.indexOf(marker) ?? -1
  return at >= 0 ? decodeURIComponent(avatar!.slice(at + marker.length)) : null
}

/** Uploads a custom profile photo and returns its public URL for saving on the profile. */
export function useUploadAvatar() {
  const { userId, avatar } = useAuth()

  return useMutation({
    mutationFn: async (file: File): Promise<string> => {
      if (!userId) throw new Error('Not signed in')
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

      // Older uploads would otherwise stay publicly reachable forever. The one
      // the profile still points at is kept until the caller has saved the new
      // URL -- the next upload (or account deletion) removes it.
      const keep = new Set([path, uploadedAvatarPath(avatar)])
      try {
        const existing = await listFolderFiles(AVATARS_BUCKET, userId)
        await removeFiles(AVATARS_BUCKET, existing.filter((p) => !keep.has(p)))
      } catch {
        // Best-effort cleanup; the new photo itself uploaded fine.
      }

      const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path)
      return data.publicUrl
    },
  })
}
