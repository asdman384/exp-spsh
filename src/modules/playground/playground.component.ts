import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-playground',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './playground.component.html',
  styleUrls: ['./playground.component.scss']
})
export class PlaygroundComponent {
  title = 'Angular Features Playground';
  
  // Add your playground data and methods here
  testFeatures = [
    { name: 'Signals', implemented: false },
    { name: 'Control Flow', implemented: false },
    { name: 'Directives', implemented: false },
    { name: 'Pipes', implemented: false },
    { name: 'Dependency Injection', implemented: false }
  ];

  onFeatureClick(feature: string) {
    console.log(`Testing: ${feature}`);
  }
}
