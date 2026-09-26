import { Command } from '@colyseus/command'
import { generateId, type Client } from 'colyseus'
import type { SkyOffice } from '../SkyOffice.ts'
import { Arrow, Note } from '../schema/OfficeState.ts'
import {
  HANDLE_SIDES,
  NOTE_COLORS,
  NOTE_LIMITS,
  type AddArrowMessage,
  type AddNoteMessage,
  type DeleteArrowMessage,
  type DeleteNoteMessage,
  type UpdateNoteMessage,
} from '../../../types/Whiteboard.ts'

// messages come straight from clients, so every field is validated before touching the state

const isCoordinate = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  Math.abs(value) <= NOTE_LIMITS.maxCoordinate

const isSize = (value: unknown): value is number =>
  typeof value === 'number' && value >= NOTE_LIMITS.minSize && value <= NOTE_LIMITS.maxSize

const isColor = (value: unknown): value is Note['color'] =>
  NOTE_COLORS.includes(value as (typeof NOTE_COLORS)[number])

const isSide = (value: unknown) => HANDLE_SIDES.includes(value as (typeof HANDLE_SIDES)[number])

abstract class WhiteboardCommand<Payload extends { whiteboardId: string }> extends Command<
  SkyOffice,
  Payload & { client: Client }
> {
  // only players who currently have the whiteboard open may edit it
  protected getEditableWhiteboard({ client, whiteboardId }: { client: Client } & Payload) {
    const whiteboard = this.room.state.whiteboards.get(String(whiteboardId))
    if (!whiteboard || !whiteboard.connectedUser.has(client.sessionId)) return null
    return whiteboard
  }
}

export class WhiteboardAddNoteCommand extends WhiteboardCommand<AddNoteMessage> {
  execute(data: AddNoteMessage & { client: Client }) {
    const whiteboard = this.getEditableWhiteboard(data)
    if (!whiteboard || whiteboard.notes.size >= NOTE_LIMITS.maxNotes) return
    if (!isCoordinate(data.x) || !isCoordinate(data.y) || !isColor(data.color)) return

    const note = new Note()
    note.x = data.x
    note.y = data.y
    note.width = NOTE_LIMITS.defaultSize
    note.height = NOTE_LIMITS.defaultSize
    note.color = data.color
    note.author = this.room.state.players.get(data.client.sessionId)?.name ?? ''
    whiteboard.notes.set(generateId(), note)
  }
}

export class WhiteboardUpdateNoteCommand extends WhiteboardCommand<UpdateNoteMessage> {
  execute(data: UpdateNoteMessage & { client: Client }) {
    const whiteboard = this.getEditableWhiteboard(data)
    const note = whiteboard?.notes.get(String(data.noteId))
    const changes = data.changes
    if (!note || typeof changes !== 'object' || changes === null) return

    if (isCoordinate(changes.x)) note.x = changes.x
    if (isCoordinate(changes.y)) note.y = changes.y
    if (isSize(changes.width)) note.width = changes.width
    if (isSize(changes.height)) note.height = changes.height
    if (isColor(changes.color)) note.color = changes.color
    if (typeof changes.text === 'string') {
      note.text = changes.text.slice(0, NOTE_LIMITS.maxTextLength)
    }
  }
}

export class WhiteboardDeleteNoteCommand extends WhiteboardCommand<DeleteNoteMessage> {
  execute(data: DeleteNoteMessage & { client: Client }) {
    const whiteboard = this.getEditableWhiteboard(data)
    const noteId = String(data.noteId)
    if (!whiteboard || !whiteboard.notes.has(noteId)) return

    whiteboard.notes.delete(noteId)
    // remove the arrows that pointed to or from the deleted note
    for (const [arrowId, arrow] of [...whiteboard.arrows.entries()]) {
      if (arrow.from === noteId || arrow.to === noteId) whiteboard.arrows.delete(arrowId)
    }
  }
}

export class WhiteboardAddArrowCommand extends WhiteboardCommand<AddArrowMessage> {
  execute(data: AddArrowMessage & { client: Client }) {
    const whiteboard = this.getEditableWhiteboard(data)
    if (!whiteboard || whiteboard.arrows.size >= NOTE_LIMITS.maxArrows) return

    const from = String(data.from)
    const to = String(data.to)
    if (from === to || !whiteboard.notes.has(from) || !whiteboard.notes.has(to)) return
    if (!isSide(data.fromSide) || !isSide(data.toSide)) return
    // one arrow per direction between two notes is enough
    for (const arrow of whiteboard.arrows.values()) {
      if (arrow.from === from && arrow.to === to) return
    }

    const arrow = new Arrow()
    arrow.from = from
    arrow.to = to
    arrow.fromSide = data.fromSide
    arrow.toSide = data.toSide
    whiteboard.arrows.set(generateId(), arrow)
  }
}

export class WhiteboardDeleteArrowCommand extends WhiteboardCommand<DeleteArrowMessage> {
  execute(data: DeleteArrowMessage & { client: Client }) {
    const whiteboard = this.getEditableWhiteboard(data)
    whiteboard?.arrows.delete(String(data.arrowId))
  }
}
