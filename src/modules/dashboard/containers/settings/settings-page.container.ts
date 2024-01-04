import { CdkDragDrop, CdkDragMove } from '@angular/cdk/drag-drop';
import { Component, OnInit } from '@angular/core';

import { Store } from '@ngrx/store';
import { first, map } from 'rxjs';

import { AppActions, categoriesSelector, loadingSelector } from 'src/@state';
import { Category } from 'src/shared/models';

const DELETE_THRESHOLD = 150;
const MOVE_THRESHOLD = 23;

@Component({
  selector: 'settings-page',
  templateUrl: './settings-page.container.html',
  styleUrl: './settings-page.container.scss'
})
export class SettingsPageContainer implements OnInit {
  readonly loading$ = this.store.select(loadingSelector);
  readonly categories$ = this.store
    .select(categoriesSelector)
    .pipe(map((categories) => [...categories].sort((a, b) => a.position - b.position)));
  category: string = '';
  dragPlaceholderText: string = '';

  constructor(private readonly store: Store) {
    this.store.dispatch(AppActions.loadCategories());
    this.store.dispatch(AppActions.setTitle({ title: 'Categories' }));
  }

  ngOnInit(): void {}

  addCategory(name: string): void {
    this.categories$.pipe(first()).subscribe((categories) => {
      const position = Math.max(...categories.map((c) => c.position), -1) + 1;
      if (~categories.findIndex((c) => c.name === name)) {
        log(`category [${name}] already exists`);
        return;
      }
      this.category = '';
      this.store.dispatch(AppActions.addCategory({ newCategory: { name, position } }));
    });
  }

  onDrop(event: CdkDragDrop<Array<Category>, undefined, Category>): void {
    if (this.tryDelete(event)) {
      return;
    }

    this.changePosition(event);
  }

  cdkDragMoved(event: CdkDragMove) {
    this.dragPlaceholderText =
      event.distance.x > DELETE_THRESHOLD && event.distance.y < MOVE_THRESHOLD ? 'Drop to remove' : '';
  }

  private tryDelete(event: CdkDragDrop<Array<Category>, undefined, Category>): boolean {
    if (event.previousIndex !== event.currentIndex) {
      return false;
    }

    if (event.distance.x > DELETE_THRESHOLD) {
      this.store.dispatch(AppActions.deleteCategory({ category: event.item.data }));
    }

    return true;
  }

  private changePosition(event: CdkDragDrop<Array<Category>, undefined, Category>): void {
    const categories = [...event.container.data];
    const start = event.previousIndex;
    const end = event.currentIndex;
    const delta = (end - start) / Math.abs(end - start);

    for (let i = start + delta; i !== end + delta; i += delta) {
      categories[i] = { ...categories[i], position: categories[i].position + delta * -1 };
    }

    categories[start] = { ...categories[start], position: end };

    this.store.dispatch(AppActions.updateCategoryPosition({ categories }));
  }
}
