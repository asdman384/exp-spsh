import { expect, type Page } from '@playwright/test';

export class DashboardPage {
  constructor(readonly page: Page) {}

  expense(comment: string) {
    return this.page.getByRole('row').filter({ has: this.page.getByRole('cell', { name: comment, exact: true }) });
  }

  async selectExpenseCategory(): Promise<string> {
    const field = this.page.getByRole('combobox', { name: 'Category', exact: true });
    await field.click();
    const [loaded] = await Promise.all([
      this.page.waitForResponse(response => response.request().method() === 'GET' && response.url().includes('/values/categories!A')),
      this.page.getByRole('option', { name: 'Click to Load', exact: true }).click(),
    ]);
    expect(loaded.ok(), `Load test categories (HTTP ${loaded.status()})`).toBeTruthy();
    const name = (await loaded.json()).values?.[0]?.[0];
    if (typeof name !== 'string' || !name.trim()) throw new Error('Add a category to the categories tab of the test spreadsheet.');
    await field.click();
    await this.page.getByRole('option', { name, exact: true }).click();
    return name;
  }

  async addExpense(amount: string, comment: string) {
    await this.page.getByRole('textbox', { name: 'Amount', exact: true }).fill(amount);
    await this.page.getByRole('textbox', { name: 'Comment', exact: true }).fill(comment);
    await this.page.getByRole('button', { name: 'Add Expense', exact: true }).click();
  }

  async deleteExpense(comment: string) {
    const row = this.expense(comment);
    await row.scrollIntoViewIfNeeded();
    const box = await row.boundingBox();
    if (!box) throw new Error('The expense row is not visible.');
    // The UI deletes a row when it is dragged more than 100 pixels to the right.
    const x = box.x + 20;
    const y = box.y + box.height / 2;
    await this.page.mouse.move(x, y);
    await this.page.mouse.down();
    try {
      await this.page.mouse.move(x + 160, y, { steps: 16 });
    } finally {
      await this.page.mouse.up();
    }
  }

  async reloadExpenses(comment: string, expectedInSheet: boolean) {
    const loaded = this.page.waitForResponse(response => response.url().includes('/gviz/tq') && response.request().method() === 'GET');
    await this.page.reload();
    const response = await loaded;
    expect(response.ok(), `Read expenses (HTTP ${response.status()})`).toBeTruthy();
    const result = await response.text();
    expect(/"status"\s*:\s*"ok"/.test(result), 'Google returned an expense table').toBeTruthy();
    expect(result.includes(comment), 'Test comment in the reloaded sheet').toBe(expectedInSheet);
    await expect(this.page.getByRole('progressbar')).toHaveCount(0);
    await expect(this.page.getByRole('status').filter({ hasText: 'Today:' })).toBeVisible();
  }
}
