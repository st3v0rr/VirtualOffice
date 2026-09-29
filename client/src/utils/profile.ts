import { parseAvatar, randomAvatar, type AvatarDescription } from '../../../types/Avatar'

export type Profile = {
  name: string
  // serialized AvatarDescription; older profiles hold one of the old characters (e.g. "adam")
  avatar: string
}

// "?profile=b" keeps a second profile, e.g. to test two players in tabs of the same browser
const profileName = new URLSearchParams(window.location.search).get('profile')
const STORAGE_KEY = profileName ? `skyoffice:profile:${profileName}` : 'skyoffice:profile'

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
