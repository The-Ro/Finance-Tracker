import { findAvatar } from '@/lib/avatars'
import { initialsFor } from '@/lib/format'

interface AvatarProps {
  avatar?: string | null
  name: string
  size?: number
  className?: string
}

function isCustomPhoto(avatar: string | null | undefined): avatar is string {
  return !!avatar && (avatar.startsWith('http://') || avatar.startsWith('https://'))
}

export function Avatar({ avatar, name, size = 28, className }: AvatarProps) {
  if (isCustomPhoto(avatar)) {
    return (
      <img
        src={avatar}
        alt={name}
        title={name}
        className={'shrink-0 rounded-full object-cover ' + (className ?? '')}
        style={{ width: size, height: size }}
      />
    )
  }

  const preset = findAvatar(avatar)
  const style = { width: size, height: size, backgroundColor: preset?.bg ?? undefined }

  return (
    <span
      className={
        'flex shrink-0 items-center justify-center rounded-full bg-accent-light font-semibold text-accent-on-light ' +
        (className ?? '')
      }
      style={style}
      title={name}
    >
      {preset ? (
        <span style={{ fontSize: size * 0.55 }}>{preset.emoji}</span>
      ) : (
        <span style={{ fontSize: size * 0.38 }}>{initialsFor(name)}</span>
      )}
    </span>
  )
}
