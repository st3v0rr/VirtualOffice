// The numbers are part of the wire protocol (and hard-coded in client-3d/scripts/bots.mjs),
// so every message has a fixed number. Removed messages leave a gap, never reuse a number:
// 4, 5 and 8-12 were the whiteboard messages (whiteboards are removed).
export enum Message {
  UPDATE_PLAYER = 0,
  UPDATE_PLAYER_NAME = 1,
  CONNECT_TO_COMPUTER = 2,
  DISCONNECT_FROM_COMPUTER = 3,
  ADD_CHAT_MESSAGE = 6,
  SEND_ROOM_DATA = 7,
  REQUEST_MEDIA_TOKEN = 13,
  UPDATE_PLAYER_AVATAR = 14,
  PLAYER_EMOTE = 15,
}
