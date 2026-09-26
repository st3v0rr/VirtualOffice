export type Profile = {
  name: string
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
