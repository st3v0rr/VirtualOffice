import React, { useState } from 'react'
import styled from 'styled-components'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Avatar from '@mui/material/Avatar'
import ArrowRightIcon from '@mui/icons-material/ArrowRight'

import { useAppSelector, useAppDispatch } from '../hooks'
import { setAudioOutputId, setLoggedIn } from '../stores/UserStore'
import { getAvatarString, getColorByString } from '../util'
import MediaSetup, { useMediaSetup } from './MediaSetup'
import AvatarEditor from './AvatarEditor'
import { loadProfile, profileAvatar, saveProfile } from '../utils/profile'
import { serializeAvatar } from '../../../types/Avatar'
import { saveMediaSettings } from '../web/mediaDevices'

import phaserGame from '../PhaserGame'
import Game from '../scenes/Game'

const Wrapper = styled.form`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #222639;
  border-radius: 16px;
  padding: 36px 60px;
  box-shadow: 0px 0px 5px #0000006f;
  max-height: calc(100vh - 32px);
  overflow-y: auto;
`

const Title = styled.p`
  margin: 5px;
  font-size: 20px;
  color: #c2c2c2;
  text-align: center;
`

const RoomName = styled.div`
  max-width: 500px;
  max-height: 120px;
  overflow-wrap: anywhere;
  overflow-y: auto;
  display: flex;
  gap: 10px;
  justify-content: center;
  align-items: center;

  h3 {
    font-size: 24px;
    color: #eee;
  }
`

const RoomDescription = styled.div`
  max-width: 500px;
  max-height: 150px;
  overflow-wrap: anywhere;
  overflow-y: auto;
  font-size: 16px;
  color: #c2c2c2;
  display: flex;
  justify-content: center;
`

const SubTitle = styled.h3`
  font-size: 16px;
  color: #eee;
  text-align: center;
`

const Content = styled.div`
  display: flex;
  margin: 36px 0;
`

const Left = styled.div`
  margin-right: 48px;
`

const Right = styled.div`
  width: 320px;
`

const Bottom = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
`

export default function LoginDialog() {
  // prefill with the profile from the last visit
  const [savedProfile] = useState(loadProfile)
  const [name, setName] = useState<string>(savedProfile?.name ?? '')
  const [avatar, setAvatar] = useState(() => profileAvatar(savedProfile))
  const [nameFieldEmpty, setNameFieldEmpty] = useState<boolean>(false)
  const dispatch = useAppDispatch()
  const roomJoined = useAppSelector((state) => state.room.roomJoined)
  const roomName = useAppSelector((state) => state.room.roomName)
  const roomDescription = useAppSelector((state) => state.room.roomDescription)
  const game = phaserGame.scene.keys.game as Game
  const media = useMediaSetup()

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (trimmedName === '') {
      setNameFieldEmpty(true)
    } else if (roomJoined) {
      saveProfile({ name: trimmedName, avatar: serializeAvatar(avatar) })
      saveMediaSettings(media.settings)
      game.registerKeys()
      game.myPlayer.setPlayerName(trimmedName)
      game.myPlayer.setAvatar(avatar)
      dispatch(setAudioOutputId(media.settings.audioOutputId))
      // hand the preview stream over to the video chat instead of requesting a new one
      const stream = media.release()
      if (stream) game.network.media?.useMediaStream(stream, media.settings)
      game.zoomToPlayer()
      dispatch(setLoggedIn(true))
    }
  }

  return (
    <Wrapper onSubmit={handleSubmit}>
      <Title>Joining</Title>
      <RoomName>
        <Avatar style={{ background: getColorByString(roomName) }}>
          {getAvatarString(roomName)}
        </Avatar>
        <h3>{roomName}</h3>
      </RoomName>
      <RoomDescription>
        <ArrowRightIcon /> {roomDescription}
      </RoomDescription>
      <Content>
        <Left>
          <SubTitle>Avatar</SubTitle>
          <AvatarEditor value={avatar} onChange={setAvatar} />
        </Left>
        <Right>
          <TextField
            autoFocus
            fullWidth
            label="Name"
            variant="outlined"
            color="secondary"
            error={nameFieldEmpty}
            helperText={nameFieldEmpty && 'Name is required'}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <MediaSetup media={media} />
        </Right>
      </Content>
      <Bottom>
        <Button variant="contained" color="secondary" size="large" type="submit">
          Join
        </Button>
      </Bottom>
    </Wrapper>
  )
}
