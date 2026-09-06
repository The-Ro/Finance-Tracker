export interface AvatarOption {
  key: string
  emoji: string
  bg: string
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  { key: 'fox', emoji: '🦊', bg: '#F3D9C4' },
  { key: 'cat', emoji: '🐱', bg: '#E6D6F5' },
  { key: 'dog', emoji: '🐶', bg: '#F5E1C8' },
  { key: 'lion', emoji: '🦁', bg: '#FBE7A1' },
  { key: 'panda', emoji: '🐼', bg: '#E4E4E4' },
  { key: 'koala', emoji: '🐨', bg: '#D9E7E5' },
  { key: 'unicorn', emoji: '🦄', bg: '#F5D9E8' },
  { key: 'owl', emoji: '🦉', bg: '#E3D3C4' },
  { key: 'penguin', emoji: '🐧', bg: '#D6E4F0' },
  { key: 'octopus', emoji: '🐙', bg: '#EAD7F0' },
  { key: 'turtle', emoji: '🐢', bg: '#DCEFD9' },
  { key: 'dragon', emoji: '🐲', bg: '#D6F0E3' },
]

export function findAvatar(key: string | null | undefined): AvatarOption | null {
  if (!key) return null
  return AVATAR_OPTIONS.find((a) => a.key === key) ?? null
}
