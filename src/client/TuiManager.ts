import blessed from 'blessed';
import { EventEmitter } from 'events';
import { ChatClient } from './ChatClient';
import { ChatWindow } from './components/ChatWindow';
import { UserList } from './components/UserList';
import { InputBar } from './components/InputBar';
import { StatusBar } from './components/StatusBar';
import { OnlineUser, RoomInfo } from '../shared/protocol/types';

export class TuiManager extends EventEmitter {
  private screen: blessed.Widgets.Screen;
  private chatWindow: ChatWindow;
  private userList: UserList;
  private inputBar: InputBar;
  private statusBar: StatusBar;
  private client: ChatClient;

  constructor(client: ChatClient) {
    super();
    this.client = client;
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'LanChat',
    });

    this.chatWindow = new ChatWindow();
    this.userList = new UserList();
    this.inputBar = new InputBar();
    this.statusBar = new StatusBar();

    this.setupLayout();
    this.setupKeyBindings();
  }

  private setupLayout(): void {
    const mainBox = blessed.box({
      parent: this.screen,
      width: '100%-30',
      height: '100%-3',
      border: 'line',
      style: {
        border: {
          fg: 'blue',
        },
      },
    });

    this.chatWindow.appendTo(mainBox);
    this.userList.attachTo(this.screen);

    const bottomBox = blessed.box({
      parent: this.screen,
      height: 3,
      bottom: 0,
      border: 'line',
    });

    this.inputBar.appendTo(bottomBox);
    this.statusBar.attachTo(this.screen);
  }

  private setupKeyBindings(): void {
    this.screen.key(['C-c'], () => {
      this.client.disconnect();
      process.exit(0);
    });

    this.screen.key(['Esc'], () => {
      this.inputBar.clear();
    });

    this.screen.key(['Tab'], () => {
      this.handleTabCompletion();
    });

    this.inputBar.on('submit', (text: string) => {
      this.handleInput(text);
    });
  }

  private handleInput(text: string): void {
    if (text.startsWith('/')) {
      this.handleCommand(text);
    } else {
      this.client.sendRoomMessage(text);
    }

    this.inputBar.clear();
  }

  private handleCommand(text: string): void {
    const [command, ...args] = text.slice(1).split(' ');

    switch (command.toLowerCase()) {
      case 'join':
        if (args[0]) {
          this.client.joinRoom(args[0]);
        }
        break;

      case 'leave':
        this.client.leaveRoom();
        break;

      case 'msg':
        if (args.length >= 2) {
          const target = args[0];
          const message = args.slice(1).join(' ');
          this.client.sendPrivateMessage(target, message);
        }
        break;

      case 'nick':
        if (args[0]) {
          this.client.changeNickname(args[0]);
        }
        break;

      case 'list':
        this.statusBar.setStatus(`在线用户: ${this.client.getOnlineUsers().length}`);
        break;

      case 'history':
        const count = args[0] ? parseInt(args[0], 10) : 50;
        this.client.requestHistory(count);
        break;

      case 'sendfile':
        if (args.length >= 2) {
          this.client.sendFile(args[0], args[1]);
        }
        break;

      case 'quit':
        this.client.disconnect();
        process.exit(0);
        break;

      default:
        this.appendMessage({
          type: 'system',
          content: `未知命令: /${command}`,
          timestamp: new Date().toISOString(),
        });
    }
  }

  private handleTabCompletion(): void {
    const users = this.client.getOnlineUsers();
    const nicknames = users.map((u) => u.nickname);

    this.inputBar.setCompletions(nicknames);
  }

  start(): void {
    this.screen.render();
    this.inputBar.focus();
    this.updateStatus();
  }

  stop(): void {
    this.screen.destroy();
  }

  appendMessage(message: {
    type: string;
    sender?: string;
    content: string;
    timestamp: string;
    room?: string;
  }): void {
    this.chatWindow.appendMessage(message);
    this.screen.render();
  }

  updateUserList(users: OnlineUser[]): void {
    this.userList.update(users);
    this.screen.render();
  }

  updateRoomList(rooms: RoomInfo[]): void {
    this.chatWindow.setTitle(`房间列表 (${rooms.length})`);
    this.screen.render();
  }

  updateStatus(): void {
    const state = this.client.getState();
    const room = this.client.getCurrentRoom();

    this.statusBar.setStatus(`状态: ${state} | 房间: ${room}`);
    this.screen.render();
  }

  setFileTransferProgress(progress: number): void {
    this.statusBar.setFileTransfer(progress);
    this.screen.render();
  }
}
