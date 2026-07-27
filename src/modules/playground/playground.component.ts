import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { AppActions } from 'src/@state';

@Component({
  selector: 'app-playground',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './playground.component.html',
  styleUrls: ['./playground.component.scss']
})
export class PlaygroundComponent implements OnInit {
  private readonly store = inject(Store);

  ngOnInit() {
    this.store.dispatch(AppActions.setTitle({ title: 'Angular Features Playground', icon: 'settings' }));
  }

  onFeatureClick(feature: string) {
    console.log(`Testing: ${feature}`);
  }
}
