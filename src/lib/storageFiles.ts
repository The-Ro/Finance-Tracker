import { supabase } from '@/lib/supabaseClient'

export const AVATARS_BUCKET = 'avatars'

// storage.list() returns only 100 entries unless asked for more.
const LIST_PAGE_SIZE = 1000
const REMOVE_BATCH_SIZE = 1000

/** Paths of every file directly inside `folder` (sub-folders are skipped). Throws on a storage error. */
export async function listFolderFiles(bucket: string, folder: string): Promise<string[]> {
  const paths: string[] = []
  for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
    const { data, error } = await supabase.storage.from(bucket).list(folder, { limit: LIST_PAGE_SIZE, offset })
    if (error) throw error
    // Folder placeholders come back with a null id.
    for (const entry of data) if (entry.id) paths.push(`${folder}/${entry.name}`)
    if (data.length < LIST_PAGE_SIZE) return paths
  }
}

export async function removeFiles(bucket: string, paths: string[]): Promise<void> {
  for (let i = 0; i < paths.length; i += REMOVE_BATCH_SIZE) {
    const { error } = await supabase.storage.from(bucket).remove(paths.slice(i, i + REMOVE_BATCH_SIZE))
    if (error) throw error
  }
}

export async function removeFolder(bucket: string, folder: string): Promise<void> {
  await removeFiles(bucket, await listFolderFiles(bucket, folder))
}
