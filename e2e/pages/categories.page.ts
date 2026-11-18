import type { Page } from '@playwright/test';

export class CategoriesPage {
  constructor(private readonly page: Page) {}

  readonly input = this.page.getByRole('textbox', { name: 'New Category' });
  readonly addButton = this.page.getByRole('button', { name: 'Add', exact: true });
  readonly rows = this.page.locator('.drag-item');

  row(name: string) {
    return this.rows.filter({ hasText: name });
  }

  async add(name: string) {
    await this.input.fill(name);
    await this.addButton.click();
  }

  async drag(name: string, target: 'right' | { above: string }) {
    const handle = this.row(name).locator('[cdkDragHandle]');
    await handle.scrollIntoViewIfNeeded();
    const box = await handle.boundingBox();
    if (!box) throw new Error('The category drag handle is not visible.');
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await this.page.mouse.move(x, y);
    await this.page.mouse.down();
    if (target === 'right') {
      await this.page.mouse.move(x + 190, y, { steps: 12 });
    } else {
      const above = await this.row(target.above).boundingBox();
      if (!above) throw new Error('The previous category is not visible.');
      await this.page.mouse.move(x, above.y + above.height / 2, { steps: 12 });
    }
    await this.page.mouse.up();
  }
}
