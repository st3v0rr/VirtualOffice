import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
  type XYPosition,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'
import AddIcon from '@mui/icons-material/Add'

import {
  NOTE_COLORS,
  NOTE_LIMITS,
  type HandleSide,
  type NoteChanges,
  type NoteColor,
} from '../../../../types/Whiteboard'
import { useAppDispatch, useAppSelector } from '../../hooks'
import { patchNote, type Board } from '../../stores/WhiteboardStore'
import phaserGame from '../../PhaserGame'
import Game from '../../scenes/Game'
import StickyNote, { type NoteNode } from './StickyNote'
import { BoardContext, noteColors, type BoardActions } from './BoardContext'

const nodeTypes = { note: StickyNote }
const emptyBoard: Board = { notes: {}, arrows: {} }
// how often changes are sent while dragging, resizing or typing
const SEND_INTERVAL = 50 // ms

// local, not yet synced state of a note (while dragging/resizing) and React Flow internals
type LocalNodeState = {
  position?: XYPosition
  width?: number
  height?: number
  measured?: { width: number; height: number }
  selected?: boolean
}

const Wrapper = styled.div`
  width: 100%;
  height: 100%;
  border-radius: 12px;
  overflow: hidden;

  .react-flow__handle {
    width: 10px;
    height: 10px;
    background: #42eacb;
    border: 2px solid #222639;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .react-flow__node:hover .react-flow__handle,
  .react-flow__node.selected .react-flow__handle,
  .react-flow__handle.connectingfrom,
  .react-flow__handle.connectingto {
    opacity: 1;
  }
`

const ToolbarPanel = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: #222639;
  border-radius: 10px;
  box-shadow: 0 2px 6px rgb(0 0 0 / 40%);

  .swatch {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    padding: 0;
  }

  .swatch.active {
    border-color: #fff;
  }

  .hint {
    font-size: 12px;
    color: #aaa;
    margin-left: 8px;
  }
`

// collects note changes per note and sends them at most every SEND_INTERVAL
function useThrottledNoteSender(whiteboardId: string) {
  const pending = useRef(new Map<string, NoteChanges>())
  const timers = useRef(new Map<string, number>())

  const flush = useCallback(
    (noteId: string) => {
      window.clearTimeout(timers.current.get(noteId))
      timers.current.delete(noteId)
      const changes = pending.current.get(noteId)
      if (!changes) return
      pending.current.delete(noteId)
      const game = phaserGame.scene.keys.game as Game
      game.network.updateWhiteboardNote({ whiteboardId, noteId, changes })
    },
    [whiteboardId]
  )

  const send = useCallback(
    (noteId: string, changes: NoteChanges, immediate = false) => {
      pending.current.set(noteId, { ...pending.current.get(noteId), ...changes })
      if (immediate) flush(noteId)
      else if (!timers.current.has(noteId)) {
        timers.current.set(
          noteId,
          window.setTimeout(() => flush(noteId), SEND_INTERVAL)
        )
      }
    },
    [flush]
  )

  // don't lose the last changes when the dialog is closed
  useEffect(() => {
    const pendingNotes = pending.current
    return () => [...pendingNotes.keys()].forEach(flush)
  }, [flush])

  return send
}

function Board({ whiteboardId }: { whiteboardId: string }) {
  const dispatch = useAppDispatch()
  const board = useAppSelector((state) => state.whiteboard.boards[whiteboardId]) ?? emptyBoard
  const { screenToFlowPosition } = useReactFlow()
  const network = (phaserGame.scene.keys.game as Game).network
  const sendNoteChanges = useThrottledNoteSender(whiteboardId)

  const [local, setLocal] = useState<Record<string, LocalNodeState>>({})
  const [selectedEdges, setSelectedEdges] = useState<Set<string>>(() => new Set())
  const [noteColor, setNoteColor] = useState<NoteColor>('yellow')
  const wrapperRef = useRef<HTMLDivElement>(null)

  const updateLocal = (id: string, changes: LocalNodeState | null) =>
    setLocal((current) => {
      const next = { ...current }
      if (changes === null) delete next[id]
      else next[id] = { ...current[id], ...changes }
      return next
    })

  const actions = useMemo<BoardActions>(
    () => ({
      updateNote: (noteId, changes, commit = false) => {
        sendNoteChanges(noteId, changes, commit)
        if (commit) dispatch(patchNote({ whiteboardId, noteId, changes }))
      },
      deleteNote: (noteId) => network.deleteWhiteboardNote({ whiteboardId, noteId }),
    }),
    [dispatch, network, sendNoteChanges, whiteboardId]
  )

  const nodes = useMemo<NoteNode[]>(
    () =>
      Object.values(board.notes).map((note) => {
        const state = local[note.id] ?? {}
        return {
          id: note.id,
          type: 'note',
          position: state.position ?? { x: note.x, y: note.y },
          width: state.width ?? note.width,
          height: state.height ?? note.height,
          measured: state.measured,
          selected: state.selected ?? false,
          data: { note },
        }
      }),
    [board.notes, local]
  )

  const edges = useMemo<Edge[]>(
    () =>
      Object.values(board.arrows).map((arrow) => ({
        id: arrow.id,
        source: arrow.from,
        target: arrow.to,
        sourceHandle: arrow.fromSide,
        targetHandle: arrow.toSide,
        selected: selectedEdges.has(arrow.id),
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: '#ddd' },
        style: { stroke: '#ddd', strokeWidth: 2 },
      })),
    [board.arrows, selectedEdges]
  )

  const onNodesChange = (changes: NodeChange<NoteNode>[]) => {
    for (const change of changes) {
      switch (change.type) {
        case 'position': {
          if (!change.position) break
          const { x, y } = change.position
          if (change.dragging) {
            updateLocal(change.id, { position: change.position })
            sendNoteChanges(change.id, { x, y })
          } else {
            // drag finished (or moved by keyboard)
            actions.updateNote(change.id, { x, y }, true)
            updateLocal(change.id, { position: undefined })
          }
          break
        }
        case 'dimensions': {
          if (!change.dimensions) break
          const { width, height } = change.dimensions
          if (change.resizing) {
            updateLocal(change.id, { width, height, measured: change.dimensions })
            sendNoteChanges(change.id, { width, height })
          } else if (change.resizing === false) {
            actions.updateNote(change.id, { width, height }, true)
            updateLocal(change.id, { width: undefined, height: undefined })
          } else {
            // measured by React Flow after rendering
            updateLocal(change.id, { measured: change.dimensions })
          }
          break
        }
        case 'select':
          updateLocal(change.id, { selected: change.selected })
          break
        case 'remove':
          actions.deleteNote(change.id)
          updateLocal(change.id, null)
          break
      }
    }
  }

  const onEdgesChange = (changes: EdgeChange[]) => {
    for (const change of changes) {
      if (change.type === 'select') {
        setSelectedEdges((current) => {
          const next = new Set(current)
          if (change.selected) next.add(change.id)
          else next.delete(change.id)
          return next
        })
      } else if (change.type === 'remove') {
        network.deleteWhiteboardArrow({ whiteboardId, arrowId: change.id })
      }
    }
  }

  const onConnect = (connection: Connection) => {
    if (!connection.sourceHandle || !connection.targetHandle) return
    network.addWhiteboardArrow({
      whiteboardId,
      from: connection.source,
      to: connection.target,
      fromSide: connection.sourceHandle as HandleSide,
      toSide: connection.targetHandle as HandleSide,
    })
  }

  // add a note centered on the given screen position
  const addNote = (screenPosition: XYPosition) => {
    const { x, y } = screenToFlowPosition(screenPosition)
    const offset = NOTE_LIMITS.defaultSize / 2
    network.addWhiteboardNote({ whiteboardId, x: x - offset, y: y - offset, color: noteColor })
  }

  const addNoteInCenter = () => {
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect) return
    addNote({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
  }

  return (
    <BoardContext.Provider value={actions}>
      <Wrapper ref={wrapperRef}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onPaneClick={(event) => {
            if (event.detail === 2) addNote({ x: event.clientX, y: event.clientY })
          }}
          connectionMode={ConnectionMode.Loose}
          deleteKeyCode={['Delete', 'Backspace']}
          zoomOnDoubleClick={false}
          minZoom={0.2}
          maxZoom={2}
          fitView={nodes.length > 0}
          fitViewOptions={{ maxZoom: 1 }}
          colorMode="dark"
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} />
          <Controls showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            nodeColor={(node) => noteColors[(node as NoteNode).data.note.color]}
          />
          <Panel position="top-left">
            <ToolbarPanel>
              <Button
                variant="contained"
                color="secondary"
                size="small"
                startIcon={<AddIcon />}
                onClick={addNoteInCenter}
              >
                Note
              </Button>
              {NOTE_COLORS.map((color) => (
                <Tooltip key={color} title={`New notes in ${color}`}>
                  <button
                    type="button"
                    aria-label={`new notes in ${color}`}
                    className={`swatch ${color === noteColor ? 'active' : ''}`}
                    style={{ background: noteColors[color] }}
                    onClick={() => setNoteColor(color)}
                  />
                </Tooltip>
              ))}
              <span className="hint">
                Double-click to add or edit · drag from a dot to connect · Del to delete
              </span>
            </ToolbarPanel>
          </Panel>
        </ReactFlow>
      </Wrapper>
    </BoardContext.Provider>
  )
}

export default function WhiteboardBoard({ whiteboardId }: { whiteboardId: string }) {
  return (
    <ReactFlowProvider>
      <Board whiteboardId={whiteboardId} />
    </ReactFlowProvider>
  )
}
