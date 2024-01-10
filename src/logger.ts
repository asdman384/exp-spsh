export {};

declare global {
  function log(...args: any[]): void;
}

const search = window.location.href.split('?')[1];
const urlParams = new URLSearchParams(search);
const loggerType: string = 'window'; //urlParams.get('logger');
const loggerOutput: Element | null = document.querySelector('#logger-output');
const clear = document.querySelector<HTMLSpanElement>('#logger-clear');
const copy = document.querySelector<HTMLSpanElement>('#logger-copy');

function getStackTrace(): string {
  var obj = {} as { stack: string };
  Error.captureStackTrace(obj, getStackTrace);
  return obj.stack;
}

function fallbackCopyTextToClipboard(text: string) {
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

function copyTextToClipboard(text: string) {
  if (!navigator.clipboard) {
    fallbackCopyTextToClipboard(text);
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

function windowLog(...args: any[]): void {
  console.log(...args);
  for (const arg of args) {
    const element = document.createElement('pre');
    let text = typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg);
    if (arg instanceof Error) {
      text += String(arg) + '\n' + getStackTrace();
    }
    text += '\n';
    element.appendChild(document.createTextNode(text));
    loggerOutput?.appendChild(element);
  }
}

if (loggerType === 'window') {
  document.querySelector('#logger-wrapper')?.classList.remove('hidden');
  clear?.addEventListener('click', () => loggerOutput?.replaceChildren());
  copy?.addEventListener('click', () => copyTextToClipboard(loggerOutput?.textContent || 'loggerOutput not found'));
  window.log = windowLog;
}
