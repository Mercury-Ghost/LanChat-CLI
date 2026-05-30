export enum MessageType {
  LOGIN_REQUEST = 0x01,
  LOGIN_RESPONSE = 0x02,
  REGISTER_REQUEST = 0x03,
  REGISTER_RESPONSE = 0x04,
  HEARTBEAT = 0x05,
  HEARTBEAT_ACK = 0x06,
  DISCONNECT = 0x07,
  ERROR = 0x08,

  ROOM_LIST = 0x10,
  USER_LIST = 0x11,
  ROOM_JOIN = 0x12,
  ROOM_JOIN_RESPONSE = 0x13,
  ROOM_LEAVE = 0x14,
  USER_JOINED = 0x15,
  USER_LEFT = 0x16,
  NICK_CHANGE = 0x17,
  NICK_CHANGE_RESPONSE = 0x18,

  CHAT_ROOM = 0x20,
  CHAT_PRIVATE = 0x21,
  CHAT_SYSTEM = 0x22,
  HISTORY_REQUEST = 0x23,
  HISTORY_RESPONSE = 0x24,

  FILE_REQUEST = 0x30,
  FILE_RESPONSE = 0x31,
  FILE_CHUNK = 0x32,
  FILE_END = 0x33,
  FILE_PROGRESS = 0x34,
  CHANGE_PASSWORD = 0x40,
}

export interface LoginRequest {
  nickname: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  nickname?: string;
  error?: string;
}

export interface RegisterRequest {
  nickname: string;
  password: string;
}

export interface RegisterResponse {
  success: boolean;
  error?: string;
}

export interface DisconnectPayload {
  reason?: string;
}

export interface ErrorPayload {
  code: string;
  message: string;
}

export interface RoomInfo {
  id: number;
  name: string;
  memberCount: number;
}

export interface RoomListPayload {
  rooms: RoomInfo[];
}

export interface UserListPayload {
  room: string;
  users: string[];
}

export interface RoomJoinRequest {
  roomName: string;
  token?: string;
}

export interface RoomJoinResponse {
  room: string;
  success: boolean;
  error?: string;
}

export interface RoomLeaveRequest {
  roomName: string;
  token?: string;
}

export interface UserJoinedPayload {
  nickname: string;
  room: string;
}

export interface UserLeftPayload {
  nickname: string;
  room: string;
}

export interface NickChangeRequest {
  newNickname: string;
  token?: string;
}

export interface NickChangeResponse {
  success: boolean;
  newNickname?: string;
  error?: string;
}

export interface ChatRoomPayload {
  room: string;
  text: string;
  timestamp: string;
  sender: string;
  token?: string;
}

export interface ChatPrivatePayload {
  target: string;
  text: string;
  timestamp: string;
  sender: string;
  token?: string;
}

export interface ChatSystemPayload {
  text: string;
  timestamp: string;
}

export interface HistoryRequestPayload {
  room?: string;
  type?: 'room' | 'private';
  count?: number;
  token?: string;
}

export interface HistoryMessage {
  sender: string;
  content: string;
  timestamp: string;
}

export interface HistoryResponsePayload {
  messages: HistoryMessage[];
}

export interface FileRequestPayload {
  fileName: string;
  fileSize: number;
  targetUser?: string;
  room?: string;
  token?: string;
}

export interface FileResponsePayload {
  transferId: string;
  accepted: boolean;
  nextChunkIndex?: number;
  reason?: string;
}

export interface FileChunkPayload {
  transferId: string;
  chunkIndex: number;
  data: string;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
  token: string;
}

export interface FileEndPayload {
  transferId: string;
  status: 'success' | 'aborted';
  reason?: string;
}

export interface FileProgressPayload {
  transferId: string;
  receivedBytes: number;
  totalBytes: number;
}

export interface Message {
  type: MessageType;
  payload: unknown;
}

export interface AuthenticatedUser {
  userId: number;
  nickname: string;
  token: string;
}

export interface OnlineUser {
  userId: number;
  nickname: string;
  socketId: string;
  activeRoom: string;
}
