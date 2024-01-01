import { Component, OnInit } from '@angular/core';
import { Store } from '@ngrx/store';
import { AppActions, categoriesSelector } from 'src/@state';

@Component({
  selector: 'settings-page',
  templateUrl: './settings-page.container.html',
  styleUrl: './settings-page.container.scss'
})
export class SettingsPageContainer implements OnInit {
  constructor(private readonly store: Store) {
    store.dispatch(AppActions.setTitle({ title: 'Categories' }));
  }

  ngOnInit(): void {
    this.store.dispatch(AppActions.loadCategories());
    this.store.select(categoriesSelector).subscribe((c) => log('categories', c));
  }
}
