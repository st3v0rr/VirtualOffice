import styled from 'styled-components'
import Tooltip from '@mui/material/Tooltip'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import VideocamIcon from '@mui/icons-material/Videocam'
import VideocamOffIcon from '@mui/icons-material/VideocamOff'

import StyledFab from './StyledFab'
import { useAppSelector } from '../hooks'
import phaserGame from '../PhaserGame'
import Game from '../scenes/Game'

const Wrapper = styled.div`
  position: fixed;
  top: 8px;
  right: 10px;
  display: flex;
  gap: 10px;

  .off {
    background: #d32f2f;
    color: #fff;

    &:hover {
      background: #b71c1c;
      color: #fff;
    }
  }
`

// mute and camera toggles shown above the video grid
export default function MediaControls() {
  const microphoneEnabled = useAppSelector((state) => state.user.microphoneEnabled)
  const cameraEnabled = useAppSelector((state) => state.user.cameraEnabled)
  const media = (phaserGame.scene.keys.game as Game).network.media

  return (
    <Wrapper>
      <Tooltip title={microphoneEnabled ? 'Mute microphone' : 'Unmute microphone'}>
        <span>
          <StyledFab
            size="small"
            aria-label="toggle microphone"
            className={microphoneEnabled === false ? 'off' : ''}
            disabled={microphoneEnabled === null}
            onClick={() => media?.setMicrophoneEnabled(!microphoneEnabled)}
          >
            {microphoneEnabled === false ? <MicOffIcon /> : <MicIcon />}
          </StyledFab>
        </span>
      </Tooltip>
      <Tooltip title={cameraEnabled ? 'Turn camera off' : 'Turn camera on'}>
        <span>
          <StyledFab
            size="small"
            aria-label="toggle camera"
            className={cameraEnabled === false ? 'off' : ''}
            disabled={cameraEnabled === null}
            onClick={() => media?.setCameraEnabled(!cameraEnabled)}
          >
            {cameraEnabled === false ? <VideocamOffIcon /> : <VideocamIcon />}
          </StyledFab>
        </span>
      </Tooltip>
    </Wrapper>
  )
}
