export {};

declare global {
  function log(...args: any[]): void;
}

const search = window.location.href.split('?')[1];
const urlParams = new URLSearchParams(search);
const loggerType = urlParams.get('logger');
const loggerOutput: Element | null = document.querySelector('#logger-output');

if (loggerType === 'window') {
  loggerOutput?.classList.remove('hidden');
}

function windowLog(...args: any[]): void {
  console.log(...args);
  for (const arg of args) {
    const newDiv = document.createElement('div');
    newDiv.appendChild(document.createTextNode(String(arg)));
    loggerOutput?.appendChild(newDiv);
  }
}

window.log = loggerType === 'console' ? console.log : loggerType === 'window' ? windowLog : () => {};
