/**
 * 消息类型枚举
 * 定义了客户端与服务器之间通信的所有消息类型
 */
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

/**
 * 登录请求接口
 */
export interface LoginRequest {
    nickname: string;
    password: string;
}

/**
 * 登录响应接口
 */
export interface LoginResponse {
    success: boolean;
    token?: string;
    userId?: number;
    nickname?: string;
    error?: string;
}

/**
 * 注册请求接口
 */
export interface RegisterRequest {
    nickname: string;
    password: string;
}

/**
 * 注册响应接口
 */
export interface RegisterResponse {
    success: boolean;
    message?: string;
    error?: string;
}

/**
 * 断开连接负载接口
 */
export interface DisconnectPayload {
    reason?: string;
}

/**
 * 错误负载接口
 */
export interface ErrorPayload {
    code: string;
    message: string;
}

/**
 * 房间信息接口
 */
export interface RoomInfo {
    id: number;
    name: string;
    memberCount: number;
}

/**
 * 房间列表负载接口
 */
export interface RoomListPayload {
    rooms: RoomInfo[];
}

/**
 * 用户列表负载接口
 */
export interface UserListPayload {
    users: OnlineUser[];
}

/**
 * 加入房间请求接口
 */
export interface RoomJoinRequest {
    roomName: string;
    token?: string;
}

/**
 * 加入房间响应接口
 */
export interface RoomJoinResponse {
    roomName?: string;
    success: boolean;
    error?: string;
}

/**
 * 离开房间请求接口
 */
export interface RoomLeaveRequest {
    roomName: string;
    token?: string;
}

/**
 * 用户加入房间负载接口
 */
export interface UserJoinedPayload {
    nickname: string;
    room: string;
}

/**
 * 用户离开房间负载接口
 */
export interface UserLeftPayload {
    nickname: string;
    room: string;
}

/**
 * 昵称修改请求接口
 */
export interface NickChangeRequest {
    newNickname: string;
    token?: string;
}

/**
 * 昵称修改响应接口
 */
export interface NickChangeResponse {
    success: boolean;
    newNickname?: string;
    error?: string;
}

/**
 * 聊天室消息负载接口
 */
export interface ChatRoomPayload {
    room: string;
    text: string;
    timestamp: string;
    sender: string;
    token?: string;
}

/**
 * 私聊消息负载接口
 */
export interface ChatPrivatePayload {
    target: string;
    text: string;
    timestamp: string;
    sender: string;
    token?: string;
}

/**
 * 系统消息负载接口
 */
export interface ChatSystemPayload {
    text: string;
    timestamp: string;
}

/**
 * 历史记录请求负载接口
 */
export interface HistoryRequestPayload {
    room?: string;
    target?: string;
    type?: 'room' | 'private';
    count?: number;
    token?: string;
}

/**
 * 历史消息接口
 */
export interface HistoryMessage {
    sender: string;
    content: string;
    timestamp: string;
}

/**
 * 历史记录响应负载接口
 */
export interface HistoryResponsePayload {
    messages: HistoryMessage[];
}

/**
 * 文件传输请求负载接口
 */
export interface FileRequestPayload {
    fileName: string;
    fileSize: number;
    targetUser?: string;
    room?: string;
    token?: string;
}

/**
 * 文件传输响应负载接口
 */
export interface FileResponsePayload {
    transferId: string;
    accepted: boolean;
    nextChunkIndex?: number;
    reason?: string;
}

/**
 * 文件块负载接口
 */
export interface FileChunkPayload {
    transferId: string;
    chunkIndex: number;
    data: string;
}

/**
 * 修改密码请求接口
 */
export interface ChangePasswordRequest {
    oldPassword: string;
    newPassword: string;
    token: string;
}

/**
 * 文件传输结束负载接口
 */
export interface FileEndPayload {
    transferId: string;
    status: 'success' | 'aborted';
    reason?: string;
}

/**
 * 文件传输进度负载接口
 */
export interface FileProgressPayload {
    transferId: string;
    receivedBytes: number;
    totalBytes: number;
}

/**
 * 通用消息接口
 */
export interface Message {
    type: MessageType;
    payload: unknown;
}

/**
 * 已认证用户接口
 */
export interface AuthenticatedUser {
    userId: number;
    nickname: string;
    token: string;
}

/**
 * 在线用户接口
 */
export interface OnlineUser {
    userId: number;
    nickname: string;
    socketId: string;
    activeRoom: string;
}

/**
 * 聊天室消息接口
 */
export interface ChatRoomMessage {
    room: string;
    sender: string;
    text: string;
    timestamp: string;
}

/**
 * 私聊消息接口
 */
export interface ChatPrivateMessage {
    from: string;
    text: string;
    timestamp: string;
}

/**
 * 房间列表消息接口
 */
export interface RoomListMessage {
    rooms: RoomInfo[];
}

/**
 * 用户列表消息接口
 */
export interface UserListMessage {
    users: OnlineUser[];
}
