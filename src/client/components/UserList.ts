import blessed, { Widgets } from 'blessed';

/**
 * 用户列表组件
 * @description 显示当前房间的在线用户列表
 */
export class UserList {
  private container: Widgets.BoxElement;

  constructor() {
    this.container = blessed.box({
      width: 30,
      height: '100%-3',
      right: 0,
      border: 'line',
      style: {
        fg: 'white',
        border: {
          fg: 'blue',
        },
      },
    });
  }

  attachTo(screen: blessed.Widgets.Screen): void {
    screen.append(this.container);
  }

  update(users: Array<{ nickname: string; userId: number }>): void {
    const userList = users.map(u => u.nickname).join('\n');
    this.container.setContent(userList || '暂无用户');
  }

  getContainer(): Widgets.BoxElement {
    return this.container;
  }
}
