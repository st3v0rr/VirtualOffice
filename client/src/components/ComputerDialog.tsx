import { useEffect, useState, useSyncExternalStore } from 'react'
import styled from 'styled-components'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import CloseIcon from '@mui/icons-material/Close'

import { useAppSelector, useAppDispatch } from '../hooks'
import { closeComputerDialog } from '../stores/ComputerStore'
import { sanitizeId } from '../util'

import Video from './Video'
import { ScreenShareSession } from '@skyoffice/media'
import phaserGame from '../PhaserGame'
import Game from '../scenes/Game'

const Backdrop = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  padding: 16px 180px 16px 16px;
`
const Wrapper = styled.div`
  width: 100%;
  height: 100%;
  background: #222639;
  border-radius: 16px;
  padding: 16px;
  color: #eee;
  position: relative;
  display: flex;
  flex-direction: column;
  box-shadow: 0px 0px 5px #0000006f;

  .close {
    position: absolute;
    top: 0px;
    right: 0px;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .error {
    color: #ffb4a9;
  }
`

const VideoGrid = styled.div`
  flex: 1;
  min-height: 0;
  display: grid;
  grid-gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(40%, 1fr));

  .video-container {
    position: relative;
    background: black;
    border-radius: 8px;
    overflow: hidden;

    video {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      min-width: 0;
      min-height: 0;
      object-fit: contain;
    }

    .player-name {
      position: absolute;
      bottom: 16px;
      left: 16px;
      color: #fff;
      overflow: hidden;
      text-overflow: ellipsis;
      text-shadow:
        0 1px 2px rgb(0 0 0 / 60%),
        0 0 2px rgb(0 0 0 / 30%);
      white-space: nowrap;
    }
  }
`

function VideoContainer({
  playerName,
  stream,
  muted = false,
}: {
  playerName?: string
  stream: MediaStream
  muted?: boolean
}) {
  return (
    <div className="video-container">
      <Video srcObject={stream} autoPlay playsInline muted={muted}></Video>
      {playerName && <div className="player-name">{playerName}</div>}
    </div>
  )
}

export default function ComputerDialog() {
  const dispatch = useAppDispatch()
  const playerNameMap = useAppSelector((state) => state.user.playerNameMap)
  const computerId = useAppSelector((state) => state.computer.computerId)!

  // one screen sharing session per opened dialog, closed when the dialog goes away
  const [session] = useState(() => {
    const game = phaserGame.scene.keys.game as Game
    return new ScreenShareSession(game.network, computerId)
  })
  useEffect(() => {
    session.open()
    return () => session.close()
  }, [session])
  const { myStream, screens, error } = useSyncExternalStore(session.subscribe, session.getSnapshot)

  return (
    <Backdrop>
      <Wrapper>
        <IconButton
          aria-label="close dialog"
          className="close"
          onClick={() => dispatch(closeComputerDialog())}
        >
          <CloseIcon />
        </IconButton>

        <div className="toolbar">
          <Button
            variant="contained"
            color="secondary"
            disabled={!!error}
            onClick={() => (myStream ? session.stopScreenShare() : session.startScreenShare())}
          >
            {myStream ? 'Stop sharing' : 'Share Screen'}
          </Button>
          {error && <span className="error">{error}</span>}
        </div>

        <VideoGrid>
          {myStream && <VideoContainer stream={myStream} playerName="You" muted />}

          {screens.map(({ id, stream }) => (
            <VideoContainer
              key={id}
              playerName={playerNameMap.get(sanitizeId(id))}
              stream={stream}
            />
          ))}
        </VideoGrid>
      </Wrapper>
    </Backdrop>
  )
}
