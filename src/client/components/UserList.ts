import blessed, { Widgets } from 'blessed';
import { OnlineUser } from '../../shared/protocol/types';

export class UserList {
  private container: Widgets.BoxElement;
  private list: Widgets.ListElement;
  private users: OnlineUser[] = [];

  constructor() {
    this.container = blessed.box({
      width: 30,
      height: '100%-3',
      right: 0,
      border: 'line',
      style: {
        border: {
          fg: 'blue',
        },
      },
    });

    const header = blessed.text({
      parent: this.container,
      top: 0,
      left: 1,
      content: '在线用户',
      style: {
        bold: true,
        fg: 'cyan',
      },
    });

    this.list = blessed.list({
      parent: this.container,
      top: 1,
      left: 0,
      width: '100%',
      height: '100%-1',
      items: [],
      style: {
        selected: {
          bg: 'blue',
        },
        item: {
          fg: 'white',
        },
      },
      scrollable: true,
      alwaysScroll: true,
    });
  }

  attachTo(screen: blessed.Widgets.Screen): void {
    screen.append(this.container);
  }

  update(users: OnlineUser[]): void {
    this.users = users;
    this.list.setItems(users.map((u) => u.nickname));
  }

  getSelectedUser(): OnlineUser | undefined {
    const selectedIndex = (this.list as any).selected;
    if (selectedIndex !== undefined && selectedIndex >= 0 && selectedIndex < this.users.length) {
      return this.users[selectedIndex];
    }
    return undefined;
  }

  getContainer(): Widgets.BoxElement {
    return this.container;
  }
}
