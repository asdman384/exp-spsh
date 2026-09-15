import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-test-perf',
  imports: [],
  templateUrl: './test-perf.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './test-perf.component.scss',
})
export class TestPerfComponent {
  items: number[] = [];

  ngOnInit() {
    this.items = Array.from({ length: 1_000 }, () =>
      Math.floor(Math.random() * 100_000)
    )
    this.items.sort((a, b) => a - b);
  }
}
