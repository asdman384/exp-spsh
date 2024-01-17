export {};

class ExpLogger {
  private readonly wrapper: HTMLDivElement;
  private readonly loggerOutput: HTMLDivElement;
  private visible = false;

  constructor(parent: HTMLElement) {
    this.wrapper = document.createElement('div');
    this.wrapper.classList.add('logger-wrapper', 'hidden');

    this.wrapper.appendChild(this.createBtn('content_copy', 'logger-copy', this.copyLog.bind(this)));
    this.wrapper.appendChild(this.createBtn('not_interested', 'logger-clear', this.clearLog.bind(this)));
    this.wrapper.appendChild(this.createBtn('memory', 'logger-toggle', this.toggleLog.bind(this)));

    this.loggerOutput = document.createElement('div');
    this.loggerOutput.classList.add('logger-output');
    this.wrapper.appendChild(this.loggerOutput);

    parent.appendChild(this.wrapper);
  }

  writeLog(...args: any[]): void {
    console.log(...args);

    for (const arg of args) {
      const element = document.createElement('pre');
      let text = typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg);
      if (arg instanceof Error) {
        text += String(arg) + '\n' + this.getStackTrace();
      }
      text += '\n';
      element.appendChild(document.createTextNode(text));
      this.loggerOutput.appendChild(element);
    }
  }

  show(): void {
    this.wrapper.classList.remove('hidden');
  }

  hide(): void {
    this.wrapper.classList.add('hidden');
  }

  private createBtn(icon: string, klass: string, handler: () => void): HTMLSpanElement {
    const copyBtn = document.createElement('span');
    copyBtn.classList.add('material-icons', klass);
    copyBtn.textContent = icon;
    copyBtn.addEventListener('click', handler);
    return copyBtn;
  }

  private clearLog(): void {
    this.loggerOutput.replaceChildren();
  }

  private copyLog(): void {
    this.copyTextToClipboard(this.loggerOutput.textContent || 'no text');
  }

  private toggleLog(): void {
    this.visible ? this.hide() : this.show();
    this.visible = !this.visible;
  }

  private copyTextToClipboard(text: string): void {
    if (!navigator.clipboard) {
      this.fallbackCopyTextToClipboard(text);
      return;
    }
    navigator.clipboard.writeText(text).then(
      function () {
        console.log('Async: Copying to clipboard was successful!');
      },
      function (err) {
        console.error('Async: Could not copy text: ', err);
      }
    );
  }

  private fallbackCopyTextToClipboard(text: string): void {
    var textArea = document.createElement('textarea');
    textArea.value = text;

    // Avoid scrolling to bottom
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      var successful = document.execCommand('copy');
      var msg = successful ? 'successful' : 'unsuccessful';
      console.log('Fallback: Copying text command was ' + msg);
    } catch (err) {
      console.error('Fallback: Oops, unable to copy', err);
    }

    document.body.removeChild(textArea);
  }

  private getStackTrace(): string {
    var obj = {} as { stack: string };
    Error.captureStackTrace(obj, this.getStackTrace.bind(this));
    return obj.stack;
  }
}

declare global {
  function log(...args: any[]): void;
}

const search = window.location.href.split('?')[1];
const urlParams = new URLSearchParams(search);
const loggerType: string = 'window'; //urlParams.get('logger');
const body = document.querySelector('body');

if (loggerType === 'window' && body) {
  const logger = new ExpLogger(body);
  window.log = logger.writeLog.bind(logger);
}
