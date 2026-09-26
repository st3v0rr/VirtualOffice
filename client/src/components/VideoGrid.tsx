import { useEffect, useRef, useSyncExternalStore } from 'react'
import styled from 'styled-components'
import MicOffIcon from '@mui/icons-material/MicOff'

import Video from './Video'
import { useAppSelector } from '../hooks'
import { getAvatarString, getColorByString, sanitizeId } from '../util'
import { setAudioOutput } from '../web/mediaDevices'
import type MediaManager from '../web/MediaManager'
import type { MediaTile } from '../web/MediaManager'

const Grid = styled.div`
  position: fixed;
  top: 56px;
  right: 10px;
  max-height: calc(100% - 120px);
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, 160px);
  grid-auto-rows: 120px;
  gap: 6px;
  width: 326px;
  justify-content: end;
`

const Tile = styled.div<{ $speaking: boolean }>`
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  background: #222639;
  box-shadow: 0 0 0 2px ${(props) => (props.$speaking ? '#42eacb' : 'rgb(229 251 255 / 60%)')};
  transition: box-shadow 0.15s;

  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  video.mirrored {
    transform: scaleX(-1);
  }

  .placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 18px;
    font-weight: 600;
  }

  .label {
    position: absolute;
    left: 6px;
    right: 6px;
    bottom: 5px;
    display: flex;
    align-items: center;
    gap: 3px;
    color: #fff;
    font-size: 12px;
    text-shadow: 0 1px 2px rgb(0 0 0 / 70%);
    white-space: nowrap;
    overflow: hidden;
  }

  .label span {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .label svg {
    font-size: 15px;
    color: #ff8a80;
    flex-shrink: 0;
  }
`

const Notice = styled.div`
  grid-column: 1 / -1;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgb(34 38 57 / 90%);
  color: #ddd;
  font-size: 12px;
`

// plays remote audio on the speaker chosen in the settings
function AudioPlayer({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null)
  const audioOutputId = useAppSelector((state) => state.user.audioOutputId)

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream])
  useEffect(() => {
    if (ref.current) setAudioOutput(ref.current, audioOutputId)
  }, [audioOutputId])

  return <audio ref={ref} autoPlay />
}

function VideoTile({ tile }: { tile: MediaTile }) {
  const playerNameMap = useAppSelector((state) => state.user.playerNameMap)
  // names can change in the settings, the one in the LiveKit token may be outdated
  const name = tile.isLocal ? 'You' : (playerNameMap.get(sanitizeId(tile.id)) ?? tile.name)

  return (
    <Tile $speaking={tile.speaking}>
      {tile.videoStream && !tile.videoMuted ? (
        <Video
          srcObject={tile.videoStream}
          autoPlay
          playsInline
          muted
          className={tile.isLocal ? 'mirrored' : undefined}
        />
      ) : (
        <div className="placeholder">
          <div className="avatar" style={{ background: getColorByString(name) }}>
            {getAvatarString(name)}
          </div>
        </div>
      )}
      {tile.audioStream && <AudioPlayer stream={tile.audioStream} />}
      <div className="label">
        {tile.audioMuted && <MicOffIcon aria-label="muted" />}
        <span>{name}</span>
      </div>
    </Tile>
  )
}

export default function VideoGrid({ media }: { media: MediaManager }) {
  const { tiles, status, canPublish } = useSyncExternalStore(media.subscribe, media.getSnapshot)

  return (
    <Grid>
      {status === 'unavailable' && <Notice>Video chat is not available right now.</Notice>}
      {status === 'connected' && !canPublish && (
        <Notice>You're in the audience. Step onto the stage to speak.</Notice>
      )}
      {tiles.map((tile) => (
        <VideoTile key={tile.id} tile={tile} />
      ))}
    </Grid>
  )
}
