import React from 'react'
import styled from 'styled-components'

import { useAppSelector, useAutoBackgroundMode } from './hooks'

import RoomSelectionDialog from './components/RoomSelectionDialog'
import LoginDialog from './components/LoginDialog'
import ComputerDialog from './components/ComputerDialog'
import WhiteboardDialog from './components/WhiteboardDialog'
import VideoConnectionDialog from './components/VideoConnectionDialog'
import Chat from './components/Chat'
import HelperButtonGroup from './components/HelperButtonGroup'
import MobileVirtualJoystick from './components/MobileVirtualJoystick'
import MediaControls from './components/MediaControls'
import VideoGrid from './components/VideoGrid'
import phaserGame from './PhaserGame'
import Game from './scenes/Game'

const Backdrop = styled.div`
  position: absolute;
  height: 100%;
  width: 100%;
`

// blurs the office (and the helper buttons) behind the join dialogs
const JoinBackdrop = styled.div`
  position: fixed;
  inset: 0;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  background: rgba(0, 0, 0, 0.15);
`

function App() {
  const loggedIn = useAppSelector((state) => state.user.loggedIn)
  const computerDialogOpen = useAppSelector((state) => state.computer.computerDialogOpen)
  const whiteboardDialogOpen = useAppSelector((state) => state.whiteboard.whiteboardDialogOpen)
  const videoConnected = useAppSelector((state) => state.user.videoConnected)
  const roomJoined = useAppSelector((state) => state.room.roomJoined)
  useAutoBackgroundMode()
  const media = loggedIn ? (phaserGame.scene.keys.game as Game).network.media : undefined

  let ui: React.JSX.Element
  if (loggedIn) {
    if (computerDialogOpen) {
      /* Render ComputerDialog if user is using a computer. */
      ui = <ComputerDialog />
    } else if (whiteboardDialogOpen) {
      /* Render WhiteboardDialog if user is using a whiteboard. */
      ui = <WhiteboardDialog />
    } else {
      ui = (
        /* Render Chat or VideoConnectionDialog if no dialogs are opened. */
        <>
          <Chat />
          {/* Render VideoConnectionDialog if user is not connected to a webcam. */}
          {!videoConnected && <VideoConnectionDialog />}
          <MobileVirtualJoystick />
        </>
      )
    }
  } else if (roomJoined) {
    /* Render LoginDialog if not logged in but selected a room. */
    ui = <LoginDialog />
  } else {
    /* Render RoomSelectionDialog if yet selected a room. */
    ui = <RoomSelectionDialog />
  }

  return (
    <Backdrop>
      {/* Render HelperButtonGroup if no dialogs are opened. */}
      {!computerDialogOpen && !whiteboardDialogOpen && <HelperButtonGroup disabled={!loggedIn} />}
      {/* While joining, blur everything behind the join dialogs (rendered on top of it). */}
      {!loggedIn && <JoinBackdrop />}
      {ui}
      {/* Render MediaControls once my webcam/mic is connected. */}
      {loggedIn && videoConnected && <MediaControls />}
      {loggedIn && media && <VideoGrid media={media} />}
    </Backdrop>
  )
}

export default App
