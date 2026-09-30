// Video/audio via LiveKit for the 3D client (React Three Fiber).
// Framework-free: the client plugs it into its own state through callbacks.

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
export { updateNearby } from './proximity'
