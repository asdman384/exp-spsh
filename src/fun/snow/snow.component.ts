import { Component } from '@angular/core';

@Component({
  selector: 'app-snow',
  standalone: true,
  imports: [],
  templateUrl: './snow.component.html',
  styleUrl: './snow.component.scss'
})
export class SnowComponent {
  protected enabled = new Date().getMonth() === 1 && new Date().getDate() === 14;

  // in accordance with scss `$total` variable
  protected numbers = Array(50)
    .fill(1)
    .map(() => Math.random() > 0.5);
}
