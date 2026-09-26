import { createSlice, PayloadAction } from '@reduxjs/toolkit'

import type { HandleSide, NoteChanges, NoteColor } from '../../../types/Whiteboard'
import phaserGame from '../PhaserGame'
import Game from '../scenes/Game'

// plain copies of the synced whiteboard schema, so they can be stored in redux
export type BoardNote = {
  id: string
  x: number
  y: number
  width: number
  height: number
  text: string
  color: NoteColor
  author: string
}

export type BoardArrow = {
  id: string
  from: string
  to: string
  fromSide: HandleSide
  toSide: HandleSide
}

export type Board = {
  notes: Record<string, BoardNote>
  arrows: Record<string, BoardArrow>
}

interface WhiteboardState {
  whiteboardDialogOpen: boolean
  whiteboardId: null | string
  boards: Record<string, Board>
}

const initialState: WhiteboardState = {
  whiteboardDialogOpen: false,
  whiteboardId: null,
  boards: {},
}

const getBoard = (state: WhiteboardState, whiteboardId: string) =>
  (state.boards[whiteboardId] ??= { notes: {}, arrows: {} })

export const whiteboardSlice = createSlice({
  name: 'whiteboard',
  initialState,
  reducers: {
    openWhiteboardDialog: (state, action: PayloadAction<string>) => {
      state.whiteboardDialogOpen = true
      state.whiteboardId = action.payload
      const game = phaserGame.scene.keys.game as Game
      game.disableKeys()
    },
    closeWhiteboardDialog: (state) => {
      const game = phaserGame.scene.keys.game as Game
      game.enableKeys()
      game.network.disconnectFromWhiteboard(state.whiteboardId!)
      state.whiteboardDialogOpen = false
      state.whiteboardId = null
    },
    upsertNote: (state, action: PayloadAction<{ whiteboardId: string; note: BoardNote }>) => {
      const { whiteboardId, note } = action.payload
      getBoard(state, whiteboardId).notes[note.id] = note
    },
    // optimistic local update, the server echoes the same change shortly after
    patchNote: (
      state,
      action: PayloadAction<{ whiteboardId: string; noteId: string; changes: NoteChanges }>
    ) => {
      const { whiteboardId, noteId, changes } = action.payload
      const note = state.boards[whiteboardId]?.notes[noteId]
      if (note) Object.assign(note, changes)
    },
    removeNote: (state, action: PayloadAction<{ whiteboardId: string; noteId: string }>) => {
      const { whiteboardId, noteId } = action.payload
      delete getBoard(state, whiteboardId).notes[noteId]
    },
    upsertArrow: (state, action: PayloadAction<{ whiteboardId: string; arrow: BoardArrow }>) => {
      const { whiteboardId, arrow } = action.payload
      getBoard(state, whiteboardId).arrows[arrow.id] = arrow
    },
    removeArrow: (state, action: PayloadAction<{ whiteboardId: string; arrowId: string }>) => {
      const { whiteboardId, arrowId } = action.payload
      delete getBoard(state, whiteboardId).arrows[arrowId]
    },
  },
})

export const {
  openWhiteboardDialog,
  closeWhiteboardDialog,
  upsertNote,
  patchNote,
  removeNote,
  upsertArrow,
  removeArrow,
} = whiteboardSlice.actions

export default whiteboardSlice.reducer
