import { createContext, useContext } from 'react'
import type { NoteChanges } from '../../../../types/Whiteboard'

export const noteColors = {
  yellow: '#fff59d',
  pink: '#f8bbd0',
  green: '#c5e1a5',
  blue: '#b3e5fc',
  orange: '#ffcc80',
  purple: '#d1c4e9',
} as const

export type BoardActions = {
  // `commit` sends immediately and applies the change locally right away
  updateNote: (noteId: string, changes: NoteChanges, commit?: boolean) => void
  deleteNote: (noteId: string) => void
}

export const BoardContext = createContext<BoardActions | null>(null)

export function useBoardActions() {
  const actions = useContext(BoardContext)
  if (!actions) throw new Error('useBoardActions must be used inside a whiteboard')
  return actions
}
