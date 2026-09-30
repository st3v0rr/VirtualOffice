import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { sanitizeId } from '../util'
import { BackgroundMode } from '../../../types/BackgroundMode'
import { loadMediaSettings } from '@skyoffice/media'
import { getSunTimes } from '../utils/sunTimes'

import phaserGame from '../PhaserGame'
import Bootstrap from '../scenes/Bootstrap'

// location used for sunrise/sunset, defaults to the center of Germany
const latitude = Number(import.meta.env.VITE_OFFICE_LATITUDE ?? 51.16)
const longitude = Number(import.meta.env.VITE_OFFICE_LONGITUDE ?? 10.45)
// civil twilight: it's considered dark once the sun is 6° below the horizon
const TWILIGHT_ALTITUDE = -6

// day between dawn and dusk at the office location, night otherwise
export function getBackgroundModeForTime(date = new Date()) {
  const sun = getSunTimes(date, latitude, longitude, TWILIGHT_ALTITUDE)
  if (!sun) {
    // polar day or night: the sun is either always above or always below the horizon at noon
    const noonAltitude = 90 - Math.abs(latitude - sunDeclinationSign(date) * 23.44)
    return noonAltitude > 0 ? BackgroundMode.DAY : BackgroundMode.NIGHT
  }
  return date >= sun.rise && date < sun.set ? BackgroundMode.DAY : BackgroundMode.NIGHT
}

// rough sign of the sun's declination: positive in northern summer
function sunDeclinationSign(date: Date) {
  const month = date.getMonth()
  return month >= 3 && month <= 8 ? 1 : -1
}

export const userSlice = createSlice({
  name: 'user',
  initialState: {
    backgroundMode: getBackgroundModeForTime(),
    sessionId: '',
    videoConnected: false,
    // state of my own microphone/camera track, null if there is no such device
    microphoneEnabled: null as boolean | null,
    cameraEnabled: null as boolean | null,
    // speaker used for the audio of other players ('' = system default)
    audioOutputId: loadMediaSettings().audioOutputId,
    loggedIn: false,
    playerNameMap: new Map<string, string>(),
    showJoystick: window.innerWidth < 650,
  },
  reducers: {
    setBackgroundMode: (state, action: PayloadAction<BackgroundMode>) => {
      if (state.backgroundMode === action.payload) return
      state.backgroundMode = action.payload
      const bootstrap = phaserGame.scene.keys.bootstrap as Bootstrap
      bootstrap.changeBackgroundMode(action.payload)
    },
    setSessionId: (state, action: PayloadAction<string>) => {
      state.sessionId = action.payload
    },
    setVideoConnected: (state, action: PayloadAction<boolean>) => {
      state.videoConnected = action.payload
    },
    setMicrophoneEnabled: (state, action: PayloadAction<boolean | null>) => {
      state.microphoneEnabled = action.payload
    },
    setCameraEnabled: (state, action: PayloadAction<boolean | null>) => {
      state.cameraEnabled = action.payload
    },
    setAudioOutputId: (state, action: PayloadAction<string>) => {
      state.audioOutputId = action.payload
    },
    setLoggedIn: (state, action: PayloadAction<boolean>) => {
      state.loggedIn = action.payload
    },
    setPlayerNameMap: (state, action: PayloadAction<{ id: string; name: string }>) => {
      state.playerNameMap.set(sanitizeId(action.payload.id), action.payload.name)
    },
    removePlayerNameMap: (state, action: PayloadAction<string>) => {
      state.playerNameMap.delete(sanitizeId(action.payload))
    },
    setShowJoystick: (state, action: PayloadAction<boolean>) => {
      state.showJoystick = action.payload
    },
  },
})

export const {
  setBackgroundMode,
  setSessionId,
  setVideoConnected,
  setAudioOutputId,
  setMicrophoneEnabled,
  setCameraEnabled,
  setLoggedIn,
  setPlayerNameMap,
  removePlayerNameMap,
  setShowJoystick,
} = userSlice.actions

export default userSlice.reducer
