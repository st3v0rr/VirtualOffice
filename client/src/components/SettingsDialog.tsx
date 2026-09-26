import { useEffect, useState } from 'react'
import styled from 'styled-components'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'

import AvatarPicker from './AvatarPicker'
import MediaSetup, { useMediaSetup } from './MediaSetup'
import { useAppDispatch, useAppSelector } from '../hooks'
import { setAudioOutputId } from '../stores/UserStore'
import { saveProfile } from '../utils/profile'
import { type MediaSettings, saveMediaSettings } from '../web/mediaDevices'
import phaserGame from '../PhaserGame'
import Game from '../scenes/Game'

const Content = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 32px 48px;
  justify-content: center;
`

const SubTitle = styled.h3`
  margin: 0 0 12px;
  font-size: 16px;
  color: #eee;
  text-align: center;
`

const Right = styled.div`
  width: 320px;
  max-width: 100%;
`

function SettingsContent({ onClose }: { onClose: () => void }) {
  const dispatch = useAppDispatch()
  const game = phaserGame.scene.keys.game as Game
  const microphoneEnabled = useAppSelector((state) => state.user.microphoneEnabled)
  const cameraEnabled = useAppSelector((state) => state.user.cameraEnabled)

  const [name, setName] = useState(game.myPlayer.playerName.text)
  const [avatar, setAvatar] = useState(game.myPlayer.playerTexture)
  const [nameFieldEmpty, setNameFieldEmpty] = useState(false)

  // start from the live mute/camera state rather than the one stored at join time
  const [liveSettings] = useState(() => {
    const settings: Partial<MediaSettings> = {}
    if (microphoneEnabled !== null) settings.audioEnabled = microphoneEnabled
    if (cameraEnabled !== null) settings.videoEnabled = cameraEnabled
    return settings
  })
  const media = useMediaSetup(liveSettings)

  // don't move the player while typing in the dialog
  useEffect(() => {
    game.disableKeys()
    return () => game.enableKeys()
  }, [game])

  const handleSave = () => {
    const trimmedName = name.trim()
    if (trimmedName === '') {
      setNameFieldEmpty(true)
      return
    }

    saveProfile({ name: trimmedName, avatar })
    saveMediaSettings(media.settings)

    if (trimmedName !== game.myPlayer.playerName.text) game.myPlayer.setPlayerName(trimmedName)
    if (avatar !== game.myPlayer.playerTexture) game.myPlayer.setPlayerTexture(avatar)

    const mediaManager = game.network.media
    dispatch(setAudioOutputId(media.settings.audioOutputId))
    // take over the preview stream, so device changes apply to running calls right away
    const stream = media.release()
    if (stream) mediaManager?.replaceMediaStream(stream, media.settings)

    onClose()
  }

  return (
    <>
      <DialogTitle>Settings</DialogTitle>
      <DialogContent>
        <Content>
          <div>
            <SubTitle>Avatar</SubTitle>
            <AvatarPicker value={avatar} onChange={setAvatar} />
          </div>
          <Right>
            <TextField
              fullWidth
              label="Name"
              variant="outlined"
              color="secondary"
              margin="dense"
              value={name}
              error={nameFieldEmpty}
              helperText={nameFieldEmpty && 'Name is required'}
              onChange={(e) => setName(e.target.value)}
            />
            <MediaSetup media={media} />
          </Right>
        </Content>
      </DialogContent>
      <DialogActions>
        <Button color="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="contained" color="secondary" onClick={handleSave}>
          Save
        </Button>
      </DialogActions>
    </>
  )
}

export default function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      slotProps={{ paper: { sx: { background: '#222639', borderRadius: '16px' } } }}
    >
      {/* only mounted while open, so the camera preview stops when the dialog closes */}
      {open && <SettingsContent onClose={onClose} />}
    </Dialog>
  )
}
