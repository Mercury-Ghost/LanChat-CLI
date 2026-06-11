export enum MessageType {
  LOGIN_REQUEST = 0x01,
  LOGIN_RESPONSE = 0x02,
  REGISTER_REQUEST = 0x03,
  REGISTER_RESPONSE = 0x04,
  HEARTBEAT_REQUEST = 0x05,
  HEARTBEAT_ACK = 0x06,
  DISCONNECT_REQUEST = 0x07,
  ERROR_RESPONSE = 0x08,
  TOKEN_LOGIN_REQUEST = 0x09,
  TOKEN_LOGIN_RESPONSE = 0x0A,
  TOKEN_REFRESH_REQUEST = 0x0B,
  TOKEN_REFRESH_RESPONSE = 0x0C,
  TOKEN_INVALIDATE_REQUEST = 0x0D,
  TOKEN_INVALIDATE_RESPONSE = 0x0E,
  ROOM_LIST_REQUEST = 0x10,
  ROOM_LIST_RESPONSE = 0x11,
  USER_LIST_REQUEST = 0x12,
  USER_LIST_RESPONSE = 0x13,
  ROOM_JOIN_REQUEST = 0x14,
  ROOM_JOIN_RESPONSE = 0x15,
  ROOM_LEAVE_REQUEST = 0x16,
  ROOM_LEAVE_RESPONSE = 0x17,
  NICK_CHANGE_REQUEST = 0x18,
  NICK_CHANGE_RESPONSE = 0x19,
  CHAT_ROOM_MESSAGE = 0x20,
  CHAT_PRIVATE_MESSAGE = 0x21,
  SYSTEM_MESSAGE = 0x22,
  HISTORY_REQUEST = 0x23,
  HISTORY_RESPONSE = 0x24,
  PASSWORD_CHANGE_REQUEST = 0x30,
  PASSWORD_CHANGE_RESPONSE = 0x31,
}

export interface User {
  id: number;
  nickname: string;
  password_hash: string;
  created_at: string;
}

export interface Room {
  id: number;
  name: string;
  created_by: number | null;
  is_default: number;
  created_at: string;
}

export interface RoomInfo {
  id: number;
  name: string;
  memberCount: number;
}

export interface Message {
  id: number;
  room_id: number;
  sender_id: number;
  content: string;
  type: string;
  timestamp: string;
}

export interface PrivateMessage {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  timestamp: string;
}

export interface UserState {
  userId: number;
  nickname: string;
  activeRoom: string;
}

export interface LoginRequestPayload {
  nickname: string;
  password: string;
}

export interface LoginResponsePayload {
  success: boolean;
  error?: string;
  token?: string;
}

export interface RegisterRequestPayload {
  nickname: string;
  password: string;
}

export interface RegisterResponsePayload {
  success: boolean;
  error?: string;
}

export interface TokenLoginRequestPayload {
  token: string;
}

export interface TokenLoginResponsePayload {
  success: boolean;
  error?: string;
  nickname?: string;
}

export interface TokenRefreshRequestPayload {
  token: string;
}

export interface TokenRefreshResponsePayload {
  success: boolean;
  error?: string;
  newToken?: string;
}

export interface TokenInvalidateRequestPayload {
  token: string;
}

export interface TokenInvalidateResponsePayload {
  success: boolean;
  error?: string;
}

export interface RoomJoinRequestPayload {
  roomName: string;
}

export interface RoomJoinResponsePayload {
  room: string;
  success: boolean;
  error?: string;
}

export interface ChatRoomMessagePayload {
  room: string;
  text: string;
  sender: string;
  timestamp: string;
}

export interface ChatPrivateMessagePayload {
  target: string;
  text: string;
  sender: string;
  timestamp: string;
}

export interface SystemMessagePayload {
  text: string;
  timestamp: string;
}

export interface HistoryRequestPayload {
  type: 'room' | 'private';
  room?: string;
  target?: string;
  count?: number;
}

export interface HistoryMessage {
  sender: string;
  content: string;
  timestamp: string;
}

export interface HistoryResponsePayload {
  messages: HistoryMessage[];
}

export interface PasswordChangeRequestPayload {
  oldPassword: string;
  newPassword: string;
}

export interface PasswordChangeResponsePayload {
  success: boolean;
  error?: string;
}

export interface ErrorResponsePayload {
  code: string;
  message: string;
}

export interface ParsedMessage {
  type: number;
  payload: unknown;
}

export interface MessageParseResult {
  messages: ParsedMessage[];
  remaining: Buffer<ArrayBufferLike>;
}

export interface HeartbeatEntry {
  interval: NodeJS.Timeout;
  lastAck: number;
  ackTimer?: NodeJS.Timeout;
}

export interface DatabaseRow {
  [key: string]: unknown;
}

export type MessagePayloadMap = {
  [MessageType.LOGIN_REQUEST]: LoginRequestPayload;
  [MessageType.LOGIN_RESPONSE]: LoginResponsePayload;
  [MessageType.REGISTER_REQUEST]: RegisterRequestPayload;
  [MessageType.REGISTER_RESPONSE]: RegisterResponsePayload;
  [MessageType.HEARTBEAT_REQUEST]: undefined;
  [MessageType.HEARTBEAT_ACK]: undefined;
  [MessageType.DISCONNECT_REQUEST]: { reason?: string };
  [MessageType.ERROR_RESPONSE]: ErrorResponsePayload;
  [MessageType.TOKEN_LOGIN_REQUEST]: TokenLoginRequestPayload;
  [MessageType.TOKEN_LOGIN_RESPONSE]: TokenLoginResponsePayload;
  [MessageType.ROOM_LIST_REQUEST]: {};
  [MessageType.ROOM_LIST_RESPONSE]: { rooms: RoomInfo[] };
  [MessageType.USER_LIST_REQUEST]: { room?: string };
  [MessageType.USER_LIST_RESPONSE]: { room: string; users: string[] };
  [MessageType.ROOM_JOIN_REQUEST]: RoomJoinRequestPayload;
  [MessageType.ROOM_JOIN_RESPONSE]: RoomJoinResponsePayload;
  [MessageType.ROOM_LEAVE_REQUEST]: { roomName?: string };
  [MessageType.NICK_CHANGE_REQUEST]: { newNickname: string };
  [MessageType.NICK_CHANGE_RESPONSE]: { success: boolean; newNickname?: string; error?: string };
  [MessageType.CHAT_ROOM_MESSAGE]: ChatRoomMessagePayload;
  [MessageType.CHAT_PRIVATE_MESSAGE]: ChatPrivateMessagePayload;
  [MessageType.SYSTEM_MESSAGE]: SystemMessagePayload;
  [MessageType.HISTORY_REQUEST]: HistoryRequestPayload;
  [MessageType.HISTORY_RESPONSE]: HistoryResponsePayload;
  [MessageType.PASSWORD_CHANGE_REQUEST]: PasswordChangeRequestPayload;
  [MessageType.PASSWORD_CHANGE_RESPONSE]: PasswordChangeResponsePayload;
};