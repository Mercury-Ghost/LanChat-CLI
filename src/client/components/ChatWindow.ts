import blessed, { Widgets } from 'blessed';

/**
 * 聊天消息窗口组件
 * @description 显示聊天消息，支持群聊、私聊和系统消息
 */
export class ChatWindow {
  private container: Widgets.BoxElement;
  private messages: Widgets.TextElement | null = null;
  private scrollable!: Widgets.ScrollableTextElement;
  private title: string = '#general';

  constructor() {
    this.container = blessed.box({
      width: '100%-30',
      height: '100%-3',
      border: 'line',
      style: {
        border: {
          fg: 'blue',
        },
      },
    });

    this.scrollable = blessed.scrollabletext({
      parent: this.container,
      top: 1,
      left: 0,
      width: '100%',
      height: '100%-1',
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      style: {
        fg: 'white',
      },
    });

    blessed.text({
      parent: this.container,
      top: 0,
      left: 1,
      content: this.title,
      style: {
        bold: true,
        fg: 'cyan',
      },
    });
  }

  appendTo(parent: Widgets.BoxElement): void {
    parent.append(this.container);
  }

  appendMessage(message: {
    type: string;
    sender?: string;
    content: string;
    timestamp: string;
    room?: string;
  }): void {
    const time = new Date(message.timestamp).toLocaleTimeString();
    let line: string;

    switch (message.type) {
      case 'system':
        line = `{green-fg}[${time}] ** ${message.content}{/green-fg}`;
        break;
      case 'private':
        line = `{yellow-fg}[${time}] [PM from ${message.sender}] ${message.content}{/yellow-fg}`;
        break;
      case 'room':
        line = `{white-fg}[${time}] <${message.sender}> ${message.content}{/white-fg}`;
        break;
      default:
        line = `{grey-fg}[${time}] ${message.content}{/grey-fg}`;
    }

    const currentContent = this.scrollable.getContent();
    const newContent = currentContent + line + '\n';
    this.scrollable.setContent(newContent);
    this.scrollable.scroll(1);
  }

  setTitle(title: string): void {
    this.title = title;
  }

  clear(): void {
    this.scrollable.setContent('');
  }

  getContainer(): Widgets.BoxElement {
    return this.container;
  }
}
