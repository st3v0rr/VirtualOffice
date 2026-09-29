import { parseAvatar, randomAvatar, type AvatarDescription } from '../../../types/Avatar'

export type Profile = {
  name: string
  // serialized AvatarDescription; older profiles hold one of the old characters (e.g. "adam")
  avatar: string
}

const STORAGE_KEY = 'skyoffice:profile'

export function loadProfile(): Profile | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {
    // storage may be unavailable (private mode, blocked site data)
  }
  return null
}

export function saveProfile(profile: Profile) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
  } catch {
    // ignore, the profile is a convenience only
  }
}

/** the avatar of the profile, a random one for new users and profiles from the old picker */
export function profileAvatar(profile: Profile | null): AvatarDescription {
  return parseAvatar(profile?.avatar) ?? randomAvatar()
}
