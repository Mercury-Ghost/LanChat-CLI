import { EventEmitter } from 'events';

/**
 * 传输层接口定义
 * 
 * @description 定义客户端与服务端通信的传输层抽象接口
 *              支持 TCP 连接、消息发送和接收等功能
 * 
 * @interface ITransport
 */
export interface ITransport {
  /**
   * 连接到服务器
   * 
   * @param host - 服务器主机地址
   * @param port - 服务器端口号
   * @returns {Promise<void>} 连接成功后 resolve
   * @throws {Error} 连接失败时抛出错误
   */
  connect(host: string, port: number): Promise<void>;

  /**
   * 发送数据
   * 
   * @param data - 要发送的数据缓冲区
   * @returns {void}
   */
  send(data: Buffer): void;

  /**
   * 关闭连接
   * 
   * @returns {void}
   */
  close(): void;

  /**
   * 检查是否已连接
   * 
   * @returns {boolean} 如果已连接返回 true
   */
  isConnected(): boolean;

  /**
   * 注册事件监听器
   */
  on(event: 'connect', listener: () => void): this;
  on(event: 'close', listener: () => void): this;
  on(event: 'message', listener: (data: Buffer) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  on(event: string, listener: (...args: unknown[]) => void): this;
}

/**
 * 传输层事件名称
 * 
 * @description 定义传输层可能发出的事件类型
 */
export enum TransportEvent {
  /** 连接成功事件 */
  CONNECT = 'connect',
  /** 连接关闭事件 */
  CLOSE = 'close',
  /** 接收到消息事件 */
  MESSAGE = 'message',
  /** 连接错误事件 */
  ERROR = 'error',
}

/**
 * 基础传输层类
 * 
 * @description 提供传输层的基础实现框架，定义通用接口和事件管理
 *              具体协议实现应继承此类
 * 
 * @extends EventEmitter
 * @implements ITransport
 */
export class BaseTransport extends EventEmitter implements ITransport {
  /** 是否已建立连接 */
  protected isSocketConnected: boolean = false;

  constructor() {
    super();
  }

  /**
   * 连接到服务器
   * 
   * @param host - 服务器主机地址
   * @param port - 服务器端口号
   * @returns {Promise<void>} 连接成功后 resolve
   * @throws {Error} 连接失败时抛出错误
   */
  async connect(_host: string, _port: number): Promise<void> {
    throw new Error('方法未实现: connect');
  }

  /**
   * 发送数据
   * 
   * @param _data - 要发送的数据缓冲区
   */
  send(_data: Buffer): void {
    if (!this.isSocketConnected) {
      throw new Error('未连接到服务器');
    }
  }

  /**
   * 关闭连接
   */
  close(): void {
    this.isSocketConnected = false;
  }

  /**
   * 检查连接状态
   * 
   * @returns {boolean} 如果已连接返回 true
   */
  isConnected(): boolean {
    return this.isSocketConnected;
  }
}

/**
 * @deprecated 使用 ITransport 接口或 BaseTransport 类
 * 保留此导出以兼容旧代码
 */
export type Transport = ITransport;
