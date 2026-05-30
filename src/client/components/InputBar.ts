import blessed, { Widgets } from 'blessed';
import { EventEmitter } from 'events';

export class InputBar {
  private container: Widgets.TextboxElement;
  private prompt: Widgets.TextElement;
  private eventEmitter: EventEmitter = new EventEmitter();
  private completions: string[] = [];
  private completionIndex: number = 0;

  constructor() {
    this.prompt = blessed.text({
      bottom: 2,
      left: 0,
      content: '> ',
      style: {
        fg: 'cyan',
        bold: true,
      },
    });

    this.container = blessed.textbox({
      bottom: 1,
      left: 2,
      width: '100%-4',
      height: 1,
      style: {
        fg: 'white',
        bg: 'black',
        focus: {
          inverse: true,
        },
      },
      inputOnFocus: true,
    });

    this.container.key(['enter'], () => {
      const text = this.container.getValue();
      if (text.trim()) {
        this.eventEmitter.emit('submit', text);
      }
      this.container.clearValue();
    });

    this.container.key(['up', 'down'], (ch: string, key: { name: string }) => {
      if (this.completions.length > 0) {
        if (key.name === 'up') {
          this.completionIndex =
            (this.completionIndex - 1 + this.completions.length) %
            this.completions.length;
        } else {
          this.completionIndex = (this.completionIndex + 1) % this.completions.length;
        }

        this.container.setValue(this.completions[this.completionIndex]);
      }
    });
  }

  appendTo(parent: Widgets.BoxElement): void {
    parent.append(this.prompt);
    parent.append(this.container);
  }

  focus(): void {
    this.container.focus();
  }

  clear(): void {
    this.container.clearValue();
  }

  setCompletions(completions: string[]): void {
    this.completions = completions;
    this.completionIndex = 0;
  }

  on(event: 'submit', callback: (text: string) => void): void {
    this.eventEmitter.on(event, callback);
  }

  getContainer(): Widgets.TextboxElement {
    return this.container;
  }
}
