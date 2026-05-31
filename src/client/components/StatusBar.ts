import blessed, { Widgets } from 'blessed';

/**
 * 状态栏组件
 * @description 显示连接状态和文件传输进度
 */
export class StatusBar {
  private container: Widgets.BoxElement;
  private statusText: Widgets.TextElement;
  private fileTransferText: Widgets.TextElement;

  constructor() {
    this.container = blessed.box({
      height: 1,
      bottom: 0,
      left: 0,
      width: '100%',
      style: {
        bg: 'grey',
        fg: 'white',
      },
    });

    this.statusText = blessed.text({
      parent: this.container,
      left: 0,
      width: '60%',
      content: '状态: 未连接',
    });

    this.fileTransferText = blessed.text({
      parent: this.container,
      right: 0,
      width: '40%',
      align: 'right',
      content: '文件传输: 无',
    });
  }

  attachTo(screen: blessed.Widgets.Screen): void {
    screen.append(this.container);
  }

  setStatus(status: string): void {
    this.statusText.setContent(status);
  }

  setFileTransfer(progress: number): void {
    if (progress > 0) {
      const bar = this.createProgressBar(progress);
      this.fileTransferText.setContent(`文件传输: ${bar} ${progress}%`);
    } else {
      this.fileTransferText.setContent('文件传输: 无');
    }
  }

  private createProgressBar(percent: number, width: number = 20): string {
    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;
    return '[' + '='.repeat(filled) + ' '.repeat(empty) + ']';
  }

  getContainer(): Widgets.BoxElement {
    return this.container;
  }
}
