import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, DOCUMENTS_BUCKET } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import type { Database } from '@/types/database.types'

export type DocumentRow = Database['public']['Tables']['documents']['Row']

const MAX_FILE_BYTES = 20 * 1024 * 1024

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export function useDocuments() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['documents', userId],
    enabled: !!userId,
    queryFn: async (): Promise<DocumentRow[]> => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('owner_user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return data
    },
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['documents', userId] })

  const upload = useMutation({
    mutationFn: async (file: File): Promise<DocumentRow> => {
      if (file.size > MAX_FILE_BYTES) {
        throw new Error(`${file.name} is larger than 20 MB and can't be uploaded.`)
      }
      const storagePath = `uploads/${userId}/${crypto.randomUUID()}-${safeFilename(file.name)}`

      const { error: uploadError } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(storagePath, file)
      if (uploadError) throw uploadError

      const { data, error } = await supabase
        .from('documents')
        .insert({
          owner_user_id: userId!,
          filename: file.name,
          mime_type: file.type || 'application/octet-stream',
          size: file.size,
          storage_path: storagePath,
          status: 'stored',
        })
        .select('*')
        .single()

      if (error) {
        await supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath])
        throw error
      }
      return data
    },
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (doc: DocumentRow) => {
      await supabase.storage.from(DOCUMENTS_BUCKET).remove([doc.storage_path])
      const { error } = await supabase.from('documents').delete().eq('id', doc.id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { ...query, upload, remove }
}

/** Opens the receipt attached to a transaction (attached via
 *  receipt_document_id) in a new tab. The documents bucket is private, so
 *  this needs a short-lived signed URL rather than a plain public link --
 *  works for the owner and for anyone with approved viewer_access to that
 *  owner's transactions (see documents_select_shared /
 *  documents_storage_select_shared in policies.sql). */
export function useViewReceipt() {
  return useMutation({
    mutationFn: async (documentId: string): Promise<{ url: string; filename: string }> => {
      const { data: doc, error: docError } = await supabase
        .from('documents')
        .select('storage_path, filename')
        .eq('id', documentId)
        .single()
      if (docError) throw docError

      const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).createSignedUrl(doc.storage_path, 60)
      if (error) throw error
      return { url: data.signedUrl, filename: doc.filename }
    },
  })
}
