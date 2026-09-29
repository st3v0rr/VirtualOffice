import { create } from 'zustand'
import type { HandleSide, NoteColor } from '../../../types/Whiteboard'

// The sticky notes and arrows of all whiteboards, mirrored from the Colyseus state.
// It is the same data the 2D client shows, so both clients edit the same boards.

export type Note = {
  id: string
  x: number
  y: number
  width: number
  height: number
  text: string
  color: NoteColor
  author: string
}
export type Arrow = {
  id: string
  from: string
  to: string
  fromSide: HandleSide
  toSide: HandleSide
}
export type Board = { notes: Record<string, Note>; arrows: Record<string, Arrow> }

type Boards = {
  boards: Record<string, Board>
  upsertNote: (boardId: string, note: Note) => void
  removeNote: (boardId: string, noteId: string) => void
  upsertArrow: (boardId: string, arrow: Arrow) => void
  removeArrow: (boardId: string, arrowId: string) => void
}

const board = (boards: Record<string, Board>, id: string) => boards[id] ?? { notes: {}, arrows: {} }

export const useBoards = create<Boards>()((set) => ({
  boards: {},
  upsertNote: (boardId, note) =>
    set((s) => {
      const b = board(s.boards, boardId)
      return {
        boards: { ...s.boards, [boardId]: { ...b, notes: { ...b.notes, [note.id]: note } } },
      }
    }),
  removeNote: (boardId, noteId) =>
    set((s) => {
      const b = board(s.boards, boardId)
      const notes = { ...b.notes }
      delete notes[noteId]
      return { boards: { ...s.boards, [boardId]: { ...b, notes } } }
    }),
  upsertArrow: (boardId, arrow) =>
    set((s) => {
      const b = board(s.boards, boardId)
      return {
        boards: { ...s.boards, [boardId]: { ...b, arrows: { ...b.arrows, [arrow.id]: arrow } } },
      }
    }),
  removeArrow: (boardId, arrowId) =>
    set((s) => {
      const b = board(s.boards, boardId)
      const arrows = { ...b.arrows }
      delete arrows[arrowId]
      return { boards: { ...s.boards, [boardId]: { ...b, arrows } } }
    }),
}))

// the colours of the 2D client's notes (client/src/components/whiteboard/BoardContext.ts)
export const NOTE_COLOR_HEX: Record<NoteColor, string> = {
  yellow: '#fff59d',
  pink: '#f8bbd0',
  green: '#c5e1a5',
  blue: '#b3e5fc',
  orange: '#ffcc80',
  purple: '#d1c4e9',
}
