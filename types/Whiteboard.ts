// shared definitions for the sticky note whiteboard

export const NOTE_COLORS = ['yellow', 'pink', 'green', 'blue', 'orange', 'purple'] as const
export type NoteColor = (typeof NOTE_COLORS)[number]

export const HANDLE_SIDES = ['top', 'right', 'bottom', 'left'] as const
export type HandleSide = (typeof HANDLE_SIDES)[number]

export const NOTE_LIMITS = {
  maxNotes: 300,
  maxArrows: 600,
  maxTextLength: 2000,
  minSize: 80,
  maxSize: 800,
  defaultSize: 180,
  maxCoordinate: 100_000,
}

export type NoteChanges = {
  x?: number
  y?: number
  width?: number
  height?: number
  text?: string
  color?: NoteColor
}

export type AddNoteMessage = { whiteboardId: string; x: number; y: number; color: NoteColor }
export type UpdateNoteMessage = { whiteboardId: string; noteId: string; changes: NoteChanges }
export type DeleteNoteMessage = { whiteboardId: string; noteId: string }
export type AddArrowMessage = {
  whiteboardId: string
  from: string
  to: string
  fromSide: HandleSide
  toSide: HandleSide
}
export type DeleteArrowMessage = { whiteboardId: string; arrowId: string }
