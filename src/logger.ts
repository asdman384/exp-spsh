export {};

declare global {
  function log(...args: any[]): void;
}

const urlParams = new URLSearchParams(window.location.search);
const logger = urlParams.get('logger');
let loggerOutput: Element | null;

if (logger === 'window') {
  loggerOutput = document.querySelector('#logger-output');
  loggerOutput?.classList.remove('hidden');
}

function windowLog(...args: any[]): void {
  for (const arg of args) {
    const newDiv = document.createElement('div');
    newDiv.appendChild(document.createTextNode(String(arg)));
    loggerOutput?.appendChild(newDiv);
  }
}

window.log = logger === 'console' ? console.log : logger === 'window' ? windowLog : () => {};
