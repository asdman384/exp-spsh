import type { Page } from '@playwright/test';

export class StatisticsPage {
  constructor(readonly page: Page) {}

  readonly summary = this.page.locator('.statistics-summary');
  readonly back = this.page.getByRole('button', { name: 'Back to categories' });

  cell(name: string) {
    return this.page.getByRole('cell', { name, exact: true });
  }

  categoryRow(name: string) {
    return this.page.getByRole('row').filter({ has: this.cell(name) });
  }

  tab(name: string) {
    return this.page.getByRole('tab', { name, exact: true });
  }
}
