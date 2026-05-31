import blessed, { Widgets } from 'blessed';

/**
 * 输入栏组件
 * @description 用户输入消息和命令的文本框组件
 */
export class InputBar {
  private input: Widgets.TextboxElement;

  constructor() {
    this.input = blessed.textbox({
      height: 1,
      left: 0,
      width: '100%-2',
      border: 'line',
      style: {
        fg: 'white',
        border: {
          fg: 'blue',
        },
        focus: {
          border: {
            fg: 'cyan',
          },
        },
      },
    });
  }

  appendTo(parent: Widgets.BoxElement): void {
    parent.append(this.input);
  }

  onSubmit(callback: (text: string) => void): void {
    this.input.on('submit', (text: string) => {
      callback(text);
      this.input.clearValue();
    });
  }

  focus(): void {
    this.input.focus();
  }

  clear(): void {
    this.input.clearValue();
  }

  setCompletions(_completions: string[]): void {
  }

  getInput(): Widgets.TextboxElement {
    return this.input;
  }
}
