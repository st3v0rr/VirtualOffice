// Video/audio via LiveKit, shared by the 2D (Phaser) and the 3D (React Three Fiber) client.
// Framework-free: each client plugs it into its own state through callbacks.

export {
  default as MediaManager,
  FAR_DISTANCE,
  MEDIA_UPDATE_INTERVAL,
  NEAR_DISTANCE,
  type GrantSource,
  type MediaManagerOptions,
  type MediaStatus,
  type MediaTile,
} from './MediaManager'
export {
  default as ScreenShareSession,
  type ScreenShareOptions,
  type SharedScreen,
} from './ScreenShareSession'
export * from './mediaDevices'
