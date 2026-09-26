import Peer, { type MediaConnection } from 'peerjs'
import Network from '../services/Network'
import store from '../stores'
import { setCameraEnabled, setMicrophoneEnabled, setVideoConnected } from '../stores/UserStore'
import {
  type MediaSettings,
  applyTrackSettings,
  getMediaStream,
  loadMediaSettings,
  setAudioOutput,
} from './mediaDevices'

export default class WebRTC {
  private myPeer: Peer
  private peers = new Map<string, { call: MediaConnection; video: HTMLVideoElement }>()
  private onCalledPeers = new Map<string, { call: MediaConnection; video: HTMLVideoElement }>()
  private videoGrid = document.querySelector('.video-grid')
  private myVideo = document.createElement('video')
  private myStream?: MediaStream
  private network: Network

  constructor(userId: string, network: Network) {
    const sanitizedId = this.replaceInvalidId(userId)
    this.myPeer = new Peer(sanitizedId)
    this.network = network
    console.log('userId:', userId)
    console.log('sanitizedId:', sanitizedId)
    this.myPeer.on('error', (err) => {
      console.log(err.type)
      console.error(err)
    })

    // mute your own video stream (you don't want to hear yourself)
    this.myVideo.muted = true

    // config peerJS
    this.initialize()
  }

  // PeerJS throws invalid_id error if it contains some characters such as that colyseus generates.
  // https://peerjs.com/docs.html#peer-id
  private replaceInvalidId(userId: string) {
    return userId.replace(/[^0-9a-z]/gi, 'G')
  }

  initialize() {
    this.myPeer.on('call', (call) => {
      if (!this.onCalledPeers.has(call.peer)) {
        call.answer(this.myStream)
        const video = document.createElement('video')
        this.onCalledPeers.set(call.peer, { call, video })

        call.on('stream', (userVideoStream) => {
          this.addVideoStream(video, userVideoStream)
        })
      }
      // on close is triggered manually with deleteOnCalledVideoStream()
    })
  }

  // request camera and microphone with the devices chosen on the join screen
  getUserMedia(alertOnError = true) {
    const settings = loadMediaSettings()
    getMediaStream(settings)
      .then((stream) => this.useMediaStream(stream, settings))
      .catch(() => {
        if (alertOnError) window.alert('No webcam or microphone found, or permission is blocked')
      })
  }

  // use an already acquired stream (e.g. the preview from the join screen) for video chat
  useMediaStream(stream: MediaStream, settings: MediaSettings) {
    applyTrackSettings(stream, settings)
    this.myStream = stream
    this.addVideoStream(this.myVideo, this.myStream)
    this.syncTrackState()
    store.dispatch(setVideoConnected(true))
    this.network.videoConnected()
  }

  /**
   * Switch to a new camera/microphone stream (e.g. from the settings dialog) without
   * hanging up: the tracks sent to the connected players are replaced in place.
   */
  replaceMediaStream(stream: MediaStream, settings: MediaSettings) {
    const oldStream = this.myStream
    if (!oldStream) return this.useMediaStream(stream, settings)

    applyTrackSettings(stream, settings)
    this.myStream = stream
    this.myVideo.srcObject = stream

    for (const { call } of [...this.peers.values(), ...this.onCalledPeers.values()]) {
      for (const transceiver of call.peerConnection?.getTransceivers() ?? []) {
        const kind = transceiver.receiver.track.kind
        const track = stream.getTracks().find((t) => t.kind === kind)
        if (track) transceiver.sender.replaceTrack(track)
      }
    }

    oldStream.getTracks().forEach((track) => track.stop())
    this.syncTrackState()
  }

  // switch the speaker used for the audio of all connected players
  setAudioOutput(deviceId: string) {
    for (const { video } of [...this.peers.values(), ...this.onCalledPeers.values()]) {
      setAudioOutput(video, deviceId)
    }
  }

  // method to call a peer
  connectToNewUser(userId: string) {
    if (this.myStream) {
      const sanitizedId = this.replaceInvalidId(userId)
      if (!this.peers.has(sanitizedId)) {
        console.log('calling', sanitizedId)
        const call = this.myPeer.call(sanitizedId, this.myStream)
        const video = document.createElement('video')
        this.peers.set(sanitizedId, { call, video })

        call.on('stream', (userVideoStream) => {
          this.addVideoStream(video, userVideoStream)
        })

        // on close is triggered manually with deleteVideoStream()
      }
    }
  }

  // method to add new video stream to videoGrid div
  addVideoStream(video: HTMLVideoElement, stream: MediaStream) {
    video.srcObject = stream
    video.playsInline = true
    if (video !== this.myVideo) setAudioOutput(video, store.getState().user.audioOutputId)
    video.addEventListener('loadedmetadata', () => {
      video.play()
    })
    if (this.videoGrid) this.videoGrid.append(video)
  }

  // method to remove video stream (when we are the host of the call)
  deleteVideoStream(userId: string) {
    const sanitizedId = this.replaceInvalidId(userId)
    if (this.peers.has(sanitizedId)) {
      const peer = this.peers.get(sanitizedId)
      peer?.call.close()
      peer?.video.remove()
      this.peers.delete(sanitizedId)
    }
  }

  // method to remove video stream (when we are the guest of the call)
  deleteOnCalledVideoStream(userId: string) {
    const sanitizedId = this.replaceInvalidId(userId)
    if (this.onCalledPeers.has(sanitizedId)) {
      const onCalledPeer = this.onCalledPeers.get(sanitizedId)
      onCalledPeer?.call.close()
      onCalledPeer?.video.remove()
      this.onCalledPeers.delete(sanitizedId)
    }
  }

  setMicrophoneEnabled(enabled: boolean) {
    this.myStream?.getAudioTracks().forEach((track) => (track.enabled = enabled))
    this.syncTrackState()
  }

  setCameraEnabled(enabled: boolean) {
    this.myStream?.getVideoTracks().forEach((track) => (track.enabled = enabled))
    this.syncTrackState()
  }

  // publish the state of my tracks for the media controls
  private syncTrackState() {
    const audioTrack = this.myStream?.getAudioTracks()[0]
    const videoTrack = this.myStream?.getVideoTracks()[0]
    store.dispatch(setMicrophoneEnabled(audioTrack ? audioTrack.enabled : null))
    store.dispatch(setCameraEnabled(videoTrack ? videoTrack.enabled : null))
  }
}
