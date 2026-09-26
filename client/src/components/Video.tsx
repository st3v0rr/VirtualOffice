import { type VideoHTMLAttributes, useEffect, useRef } from 'react'
import { useAppSelector } from '../hooks'
import { setAudioOutput } from '../web/mediaDevices'

type PropsType = VideoHTMLAttributes<HTMLVideoElement> & {
  srcObject: MediaStream
}

export default function Video({ srcObject, ...props }: PropsType) {
  const refVideo = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!refVideo.current) return
    refVideo.current.srcObject = srcObject
  }, [srcObject])

  // play the audio on the speaker chosen by the user
  const audioOutputId = useAppSelector((state) => state.user.audioOutputId)
  useEffect(() => {
    if (!refVideo.current || props.muted) return
    setAudioOutput(refVideo.current, audioOutputId)
  }, [audioOutputId, props.muted])

  return <video ref={refVideo} {...props} />
}
