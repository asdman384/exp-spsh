import { CdkDrag, CdkDragMove } from '@angular/cdk/drag-drop';
import { Component, OnInit } from '@angular/core';

import { Store } from '@ngrx/store';

import { AppActions, categoriesSelector } from 'src/@state';

const DELETE_THRESHOLD = 150;

@Component({
  selector: 'settings-page',
  templateUrl: './settings-page.container.html',
  styleUrl: './settings-page.container.scss'
})
export class SettingsPageContainer implements OnInit {
  readonly categories$ = this.store.select(categoriesSelector);
  listDisabled = false;
  dragPlaceholderText: string = '';

  constructor(private readonly store: Store) {
    store.dispatch(AppActions.setTitle({ title: 'Categories' }));
  }

  ngOnInit(): void {
    this.store.dispatch(AppActions.loadCategories());
  }

  onDrop(e: any): void {}

  cdkDragMoved(event: CdkDragMove) {
    this.dragPlaceholderText = event.distance.x > DELETE_THRESHOLD ? 'Drop to remove' : '';
  }
}
