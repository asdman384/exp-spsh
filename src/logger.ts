export {};

declare global {
  function log(...args: any[]): void;
}

const search = window.location.href.split('?')[1];
const urlParams = new URLSearchParams(search);
const loggerType = urlParams.get('logger');
const loggerOutput: Element | null = document.querySelector('#logger-output');
const clear = document.querySelector<HTMLSpanElement>('#logger-clear');

if (loggerType === 'window') {
  document.querySelector('#logger-wrapper')?.classList.remove('hidden');
  clear?.addEventListener('click', () => loggerOutput?.replaceChildren());
}

function windowLog(...args: any[]): void {
  console.log(...args);
  for (const arg of args) {
    const element = document.createElement('pre');
    const text = typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg);
    element.appendChild(document.createTextNode(text));
    loggerOutput?.appendChild(element);
  }
}

window.log = loggerType === 'console' ? console.log : loggerType === 'window' ? windowLog : () => {};
