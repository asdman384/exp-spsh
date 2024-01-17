import { CdkDragDrop, CdkDragMove, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, OnInit } from '@angular/core';
import { NgModel } from '@angular/forms';

import { Store } from '@ngrx/store';
import { first } from 'rxjs';

import { AppActions, categoriesSelector, loadingSelector } from 'src/@state';
import { Category } from 'src/shared/models';

const DELETE_THRESHOLD = 150;
const MOVE_THRESHOLD = 23;

@Component({
  selector: 'categories-page',
  templateUrl: './categories-page.container.html',
  styleUrl: './categories-page.container.scss'
})
export class CategoriesPageContainer {
  readonly loading$ = this.store.select(loadingSelector);
  readonly categories$ = this.store.select(categoriesSelector);
  category: string = '';
  dragPlaceholderText: string = '';

  constructor(private readonly store: Store) {
    this.store.dispatch(AppActions.loadCategories());
    this.store.dispatch(AppActions.setTitle({ title: 'Spending categories', icon: 'category' }));
  }

  addCategory(name: string, control: NgModel): void {
    this.categories$.pipe(first()).subscribe((categories) => {
      const position = Math.max(...categories.map((c) => c.id), -1) + 1;
      if (~categories.findIndex((c) => c.name === name)) {
        log(`category [${name}] already exists`);
        return;
      }
      control.reset();
      this.store.dispatch(AppActions.addCategory({ newCategory: { name, id: position } }));
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
    moveItemInArray(categories, event.previousIndex, event.currentIndex);
    this.store.dispatch(AppActions.updateCategoryPosition({ categories }));
  }
}
