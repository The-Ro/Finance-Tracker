import { useEffect, useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { Avatar } from '@/components/ui/Avatar'
import { initialsFor } from '@/lib/format'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useUpdateProfile } from '@/hooks/useUpdateProfile'
import { useUploadAvatar } from '@/hooks/useUploadAvatar'
import { AVATAR_OPTIONS } from '@/lib/avatars'
import clsx from 'clsx'
import { FormError } from '@/components/ui/FieldError'
import { PhotoCropper } from './PhotoCropper'
import { useProfiles } from '@/hooks/useProfiles'

export function AvatarPicker() {
  const { avatar, displayName, email, userId } = useAuth()
  const profiles = useProfiles().data
  const savedBio = (userId && profiles?.[userId]?.bio) || ''
  const update = useUpdateProfile()
  const upload = useUploadAvatar()
  const { show } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [nameDraft, setNameDraft] = useState(displayName)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [bioDraft, setBioDraft] = useState(savedBio)
  useEffect(() => {
    setBioDraft(savedBio)
  }, [savedBio])
  // A chosen photo waits here while it's being cropped.
  const [toCrop, setToCrop] = useState<File | null>(null)

  // `displayName` loads asynchronously; keep the draft in sync until the user starts typing.
  useEffect(() => {
    setNameDraft(displayName)
  }, [displayName])

  const saveAvatar = async (value: string | null) => {
    setAvatarError(null)
    try {
      await update.mutateAsync({ avatar: value })
      show('Profile picture saved.')
    } catch (e) {
      setAvatarError(e instanceof Error ? e.message : 'Could not save.')
    }
  }

  const handleFileChange = (file: File | undefined) => {
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!file) return
    setAvatarError(null)
    if (!file.type.startsWith('image/')) return setAvatarError('Pick a photo (JPG, PNG or similar).')
    setToCrop(file)
  }

  const uploadPhoto = async (file: File) => {
    setAvatarError(null)
    try {
      const url = await upload.mutateAsync(file)
      await saveAvatar(url)
      setToCrop(null)
    } catch (e) {
      setToCrop(null)
      setAvatarError(e instanceof Error ? e.message : 'Could not upload that photo.')
    }
  }

  const handleSaveName = async () => {
    setNameError(null)
    const trimmed = nameDraft.trim()
    if (!trimmed) return setNameError('Display name cannot be empty.')
    try {
      await update.mutateAsync({ displayName: trimmed })
      show('Display name saved.')
    } catch (e) {
      setNameError(e instanceof Error ? e.message : 'Could not save.')
    }
  }

  const handleSaveBio = async () => {
    setNameError(null)
    try {
      await update.mutateAsync({ bio: bioDraft.trim() || null })
      show('Saved.')
    } catch (e) {
      setNameError(e instanceof Error ? e.message : 'Could not save.')
    }
  }

  const busy = update.isPending || upload.isPending

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Profile</h3>
        <p className="mt-1 text-helper text-slate-500">
          Your name and picture are shown next to your entries in shared views.
        </p>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <TextField label="Display name" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} />
        </div>
        <Button onClick={handleSaveName} disabled={update.isPending || nameDraft.trim() === displayName}>
          Save
        </Button>
      </div>
      <FormError message={nameError} />

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <TextField
            label="About you · friends see this"
            value={bioDraft}
            maxLength={160}
            placeholder="A line about you"
            onChange={(e) => setBioDraft(e.target.value)}
          />
        </div>
        <Button onClick={handleSaveBio} disabled={update.isPending || bioDraft.trim() === savedBio.trim()}>
          Save
        </Button>
      </div>

      <div className="flex items-center gap-3 border-t border-app-border pt-4">
        <Avatar avatar={avatar} name={displayName || email || '?'} size={56} className="text-2xl" />
        <p className="text-helper text-slate-500">
          Tap an avatar below, or use the upload icon at the end to use your own photo.
        </p>
      </div>

      <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
        <button
          type="button"
          onClick={() => saveAvatar(null)}
          disabled={busy}
          aria-label="Use initials instead of an avatar"
          className={clsx(
            'flex h-11 w-11 items-center justify-center rounded-full border-2 bg-accent-light text-xs font-semibold text-accent-on-light transition-transform hover:scale-110 active:scale-95 disabled:opacity-50 disabled:hover:scale-100',
            avatar === null ? 'border-accent' : 'border-transparent'
          )}
        >
          {initialsFor(displayName || email || '?')}
        </button>
        {AVATAR_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => saveAvatar(opt.key)}
            disabled={busy}
            aria-label={`Choose ${opt.key} avatar`}
            className={clsx(
              'flex h-11 w-11 items-center justify-center rounded-full border-2 text-xl transition-transform hover:scale-110 active:scale-95 disabled:opacity-50 disabled:hover:scale-100',
              avatar === opt.key ? 'border-accent' : 'border-transparent'
            )}
            style={{ backgroundColor: opt.bg }}
          >
            {opt.emoji}
          </button>
        ))}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFileChange(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          aria-label="Upload your own photo"
          title="Upload your own photo"
          className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-dashed border-app-border text-slate-500 transition-transform hover:scale-110 hover:border-accent hover:text-accent-dark active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
        >
          {upload.isPending ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Upload size={16} />
          )}
        </button>
      </div>

      <FormError message={avatarError} />
      <PhotoCropper file={toCrop} busy={busy} onCancel={() => setToCrop(null)} onDone={uploadPhoto} />
    </Card>
  )
}
