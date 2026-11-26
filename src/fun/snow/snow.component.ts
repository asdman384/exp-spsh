import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-snow',
  imports: [CommonModule],
  templateUrl: './snow.component.html',
  styleUrl: './snow.component.scss',
  host: {
    '[class.heart]': 'ocasion === "heart"',
    '[class.snow]': 'ocasion === "snow"',
  },
})
export class SnowComponent {
  protected isFeb14 = new Date().getMonth() === 1 && new Date().getDate() === 14;
  protected enabled = [0, 1, 11].includes(new Date().getMonth());

  ocasion: 'heart' | 'snow' = this.isFeb14 ? 'heart' : 'snow';

  protected readonly icons = {
    snow: { regular: 'snowflake', alternate: 'mode_cool' },
    heart: { regular: 'favorite', alternate: 'favorite_border' },
  };

  // in accordance with scss `$total` variable
  protected numbers = Array(50)
    .fill(1)
    .map(() => Math.random() > 0.5);
}
