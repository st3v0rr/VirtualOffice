import { memo, useState } from 'react'
import styled from 'styled-components'
import {
  Handle,
  NodeResizer,
  NodeToolbar,
  Position,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import DeleteIcon from '@mui/icons-material/DeleteOutlined'

import { NOTE_COLORS, NOTE_LIMITS } from '../../../../types/Whiteboard'
import type { BoardNote } from '../../stores/WhiteboardStore'
import { noteColors, useBoardActions } from './BoardContext'

export type NoteNode = Node<{ note: BoardNote }, 'note'>

const Card = styled.div<{ $color: string }>`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 12px;
  background: ${(props) => props.$color};
  color: #222;
  border-radius: 4px;
  box-shadow: 0 3px 8px rgb(0 0 0 / 35%);
  font-size: 15px;
  line-height: 1.35;

  .text {
    flex: 1;
    overflow: hidden;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .placeholder {
    color: rgb(0 0 0 / 35%);
  }

  textarea {
    flex: 1;
    resize: none;
    border: none;
    outline: none;
    background: transparent;
    font: inherit;
    color: inherit;
    padding: 0;
  }

  .author {
    margin-top: 6px;
    font-size: 11px;
    color: rgb(0 0 0 / 45%);
    text-align: right;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  background: #222639;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgb(0 0 0 / 40%);

  .swatch {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    padding: 0;
  }

  .swatch.active {
    border-color: #fff;
  }
`

const sides = [
  { id: 'top', position: Position.Top },
  { id: 'right', position: Position.Right },
  { id: 'bottom', position: Position.Bottom },
  { id: 'left', position: Position.Left },
]

function StickyNote({ id, data, selected }: NodeProps<NoteNode>) {
  const { note } = data
  const { updateNote, deleteNote } = useBoardActions()
  // while editing, the text lives here so incoming updates don't disturb typing
  const [draft, setDraft] = useState<string | null>(null)

  const finishEditing = () => {
    if (draft !== null && draft !== note.text) updateNote(id, { text: draft }, true)
    setDraft(null)
  }

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={NOTE_LIMITS.minSize}
        minHeight={NOTE_LIMITS.minSize}
        maxWidth={NOTE_LIMITS.maxSize}
        maxHeight={NOTE_LIMITS.maxSize}
        color="#42eacb"
      />
      <NodeToolbar isVisible={selected && draft === null} position={Position.Top}>
        <Toolbar>
          {NOTE_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`${color} note`}
              className={`swatch ${note.color === color ? 'active' : ''}`}
              style={{ background: noteColors[color] }}
              onClick={() => updateNote(id, { color }, true)}
            />
          ))}
          <Tooltip title="Delete note">
            <IconButton size="small" onClick={() => deleteNote(id)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </NodeToolbar>

      {sides.map((side) => (
        <Handle key={side.id} id={side.id} type="source" position={side.position} />
      ))}

      <Card
        $color={noteColors[note.color] ?? noteColors.yellow}
        onDoubleClick={() => setDraft(note.text)}
      >
        {draft !== null ? (
          <textarea
            className="nodrag nowheel"
            autoFocus
            value={draft}
            maxLength={NOTE_LIMITS.maxTextLength}
            onFocus={(e) => e.currentTarget.setSelectionRange(draft.length, draft.length)}
            onChange={(e) => {
              setDraft(e.target.value)
              // let the others watch while typing
              updateNote(id, { text: e.target.value })
            }}
            onBlur={finishEditing}
            onKeyDown={(e) => {
              if (e.key === 'Escape') e.currentTarget.blur()
            }}
          />
        ) : (
          <div className={`text ${note.text ? '' : 'placeholder'}`}>
            {note.text || 'Double-click to write…'}
          </div>
        )}
        {note.author && <div className="author">{note.author}</div>}
      </Card>
    </>
  )
}

export default memo(StickyNote)
