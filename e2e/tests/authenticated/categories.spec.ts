import type { Page } from '@playwright/test';
import { expect, test } from '../../fixtures/test';

test.describe.configure({ timeout: 90_000 });

async function loadCategories(page: Page, spreadsheetId: string, reload = false) {
  const path = `/v4/spreadsheets/${spreadsheetId}/values/categories!A:B`;
  const [response] = await Promise.all([
    page.waitForResponse(
      response => response.request().method() === 'GET' && decodeURIComponent(new URL(response.url()).pathname) === path,
    ),
    reload ? page.reload() : page.goto('./#/dashboard/categories'),
  ]);
  expect(response.ok(), `Load categories (HTTP ${response.status()})`).toBeTruthy();
  const { values = [] } = (await response.json()) as { values?: [string, number][] };
  return values.map(([name]) => name);
}

test('add a category, reject its duplicate, and swipe to delete it', async ({ page, categoriesPage, categoryData }) => {
  const { spreadsheetId, first } = categoryData;
  const original = await loadCategories(page, spreadsheetId);
  await expect(categoriesPage.addButton).toBeDisabled();
  await categoriesPage.add(first);
  await expect(categoriesPage.row(first)).toBeVisible();
  await expect(categoriesPage.input).toHaveValue('');
  await categoriesPage.add(first);
  await expect(categoriesPage.input).toHaveValue(first);
  expect(await loadCategories(page, spreadsheetId, true)).toEqual([...original, first]);
  await expect(categoriesPage.row(first)).toHaveCount(1);

  await categoriesPage.drag(first, 'right');
  await expect(categoriesPage.row(first)).toHaveCount(0);
  expect(await loadCategories(page, spreadsheetId, true)).toEqual(original);
  await expect(categoriesPage.row(first)).toHaveCount(0);
});

test('drag a category above its neighbor and keep the order after reload', async ({ page, categoriesPage, categoryData }) => {
  const { spreadsheetId, first, second } = categoryData;
  const original = await loadCategories(page, spreadsheetId);
  await categoriesPage.add(first);
  await expect(categoriesPage.row(first)).toBeVisible();
  await categoriesPage.add(second);
  await expect(categoriesPage.row(second)).toBeVisible();

  const path = `/v4/spreadsheets/${spreadsheetId}/values/categories!A1:B${original.length + 2}`;
  const [saved] = await Promise.all([
    page.waitForResponse(
      response => response.request().method() === 'PUT' && decodeURIComponent(new URL(response.url()).pathname) === path,
    ),
    categoriesPage.drag(second, { above: first }),
  ]);
  expect(saved.ok(), `Save category order (HTTP ${saved.status()})`).toBeTruthy();
  expect(await loadCategories(page, spreadsheetId, true)).toEqual([...original, second, first]);
  await expect(categoriesPage.rows.nth(original.length)).toContainText(second);
  await expect(categoriesPage.rows.last()).toContainText(first);
});
