import blessed from 'blessed';
import type { Widgets } from 'blessed';
import { ChatWindow } from './components/ChatWindow';
import { UserList } from './components/UserList';
import { InputBar } from './components/InputBar';
import { StatusBar } from './components/StatusBar';
import { OnlineUser, RoomInfo } from '../shared/protocol/types';

type MessageData = {
  type: string;
  sender?: string;
  content: string;
  timestamp: string;
  room?: string;
};

/**
 * TUI 管理器类
 * @description 管理终端用户界面的各个组件，协调用户交互和界面更新
 */
export class TuiManager {
  private screen: Widgets.Screen;
  private chatWindow: ChatWindow;
  private userList: UserList;
  private inputBar: InputBar;
  private statusBar: StatusBar;
  private mainContainer: Widgets.BoxElement;
  private isRunning: boolean = false;

  /**
   * 构造函数
   * @description 初始化所有 UI 组件并设置基础布局
   */
  constructor() {
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'LanChat CLI',
    });

    this.chatWindow = new ChatWindow();
    this.userList = new UserList();
    this.inputBar = new InputBar();
    this.statusBar = new StatusBar();

    this.mainContainer = blessed.box({
      width: '100%',
      height: '100%',
    });

    this.setupLayout();
    this.setupKeyBindings();
  }

  /**
   * 设置界面布局
   * @private
   */
  private setupLayout(): void {
    this.screen.append(this.mainContainer);
    this.chatWindow.appendTo(this.mainContainer);
    this.userList.attachTo(this.screen);
    this.inputBar.appendTo(this.mainContainer);
    this.statusBar.attachTo(this.screen);

    this.inputBar.focus();
  }

  /**
   * 设置键盘快捷键
   * @private
   */
  private setupKeyBindings(): void {
    this.screen.key(['C-c'], () => {
      process.exit(0);
    });

    this.screen.key(['Tab'], () => {
      // 切换焦点
    });

    this.screen.key(['Escape'], () => {
      // 取消当前操作
    });
  }

  /**
   * 获取输入回调设置器
   * @param callback - 输入提交时的回调函数
   */
  setInputCallback(callback: (text: string) => void): void {
    this.inputBar.onSubmit(callback);
  }

  /**
   * 更新用户列表显示
   * @param users - 用户列表
   */
  updateUserList(users: OnlineUser[]): void {
    this.userList.update(users);
    this.screen.render();
  }

  /**
   * 更新房间列表显示
   * @param rooms - 房间列表
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  updateRoomList(rooms: RoomInfo[]): void {
    this.screen.render();
  }

  /**
   * 显示消息
   * @param message - 消息对象
   */
  showMessage(message: {
    type: string;
    sender?: string;
    content: string;
    timestamp: string;
    room?: string;
  }): void {
    this.chatWindow.appendMessage(message);
    this.screen.render();
  }

  /**
   * 更新连接状态
   * @param status - 状态文本
   */
  setStatus(status: string): void {
    this.statusBar.setStatus(status);
    this.screen.render();
  }

  /**
   * 显示文件传输进度
   * @param progress - 进度百分比 (0-100)
   */
  showFileTransferProgress(progress: number): void {
    this.statusBar.setFileTransfer(progress);
    this.screen.render();
  }

  /**
   * 渲染界面
   */
  render(): void {
    this.screen.render();
  }

  /**
   * 销毁 TUI
   */
  destroy(): void {
    this.screen.destroy();
  }

  /**
   * 启动 TUI
   * @description 开始渲染界面并设置焦点
   */
  start(): void {
    this.isRunning = true;
    this.screen.render();
    this.inputBar.focus();
  }

  /**
   * 停止 TUI
   * @description 停止界面渲染并清理资源
   */
  stop(): void {
    this.isRunning = false;
    this.destroy();
  }

  /**
   * 添加消息到聊天窗口
   * @param message - 消息对象
   */
  appendMessage(message: MessageData): void {
    this.chatWindow.appendMessage(message);
    this.screen.render();
  }
}
