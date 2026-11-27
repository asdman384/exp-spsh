import { Component } from '@angular/core';

@Component({
  selector: 'exp-skeleton',
  host: { role: 'img', 'aria-label': 'Loading' },
  template: '',
  styles: `
    :host {
      display: inline-block;
      width: 100%;
      max-inline-size: 100%;
      block-size: 1em;
      vertical-align: middle;
      border-radius: 0.2em;
      background-color: currentColor;
      opacity: 0.15;
    }

    @media (prefers-reduced-motion: no-preference) {
      :host {
        background-image: linear-gradient(90deg, transparent 40%, rgb(255 255 255 / 85%) 50%, transparent 60%);
        background-size: 300% 100%;
        animation: wave 1.6s ease-in-out infinite;
      }
    }

    @keyframes wave {
      from {
        background-position: 100% 0;
      }
      to {
        background-position: 0 0;
      }
    }
  `,
})
export class SkeletonComponent {}
