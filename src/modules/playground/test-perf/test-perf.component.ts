import { Component, input, OnInit } from '@angular/core';

@Component({
  selector: 'app-test-perf',
  imports: [],
  templateUrl: './test-perf.component.html',
  styleUrl: './test-perf.component.scss',
})
export class TestPerfComponent implements OnInit {
  items: number[] = [];

  testInput = input.required<string>();

  constructor() {
    this.items = Array.from({ length: 1_000_000 }, () =>
      Math.floor(Math.random() * 100_000)
    )
    this.items.sort((a, b) => a - b);
  }

  ngOnInit() {
    // this.items = Array.from({ length: 1_000_000 }, () =>
    //   Math.floor(Math.random() * 100_000)
    // )
    // this.items.sort((a, b) => a - b);
  }
}
