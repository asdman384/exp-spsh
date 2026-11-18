import type { Page } from '@playwright/test';
import { expect, test } from '../../fixtures/test';

const timeZone = 'Europe/Warsaw';
test.use({ timezoneId: timeZone });

test('a signed-in user can add spending for today and delete it', async ({ page, dashboardPage, spending, headless }) => {
  test.setTimeout(90_000);
  const { spreadsheetId, comment } = spending;
  const row = dashboardPage.expense(comment);

  // 1. Dashboard and default date
  await test.step("Open the dashboard and check today's date", async () => {
    const today = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'short', day: 'numeric' }).format(new Date());
    await page.goto('./#/dashboard');
    await expect(page).toHaveURL(/#\/dashboard$/);
    await expect(page.getByRole('textbox', { name: 'Date', exact: true })).toHaveValue(today);
  });

  // 2. Expense entry
  const category = await test.step('Select a category and add a 12.34 expense', async () => {
    const selectedCategory = await dashboardPage.selectExpenseCategory();
    const [saved] = await Promise.all([waitForWrite(page, spreadsheetId, 'insertDimension'), dashboardPage.addExpense('12.34', comment)]);
    expect(saved.ok(), `Save expense (HTTP ${saved.status()})`).toBeTruthy();
    return selectedCategory;
  });

  // 3. Delivery status
  await test.step('Check that one expense is visible and marked as sent', async () => {
    await expect(row).toHaveCount(1);
    await expect(row.getByRole('img', { name: 'Not sent yet' })).toHaveCount(0);
  });

  // 4. Saved values
  await test.step('Reload and check the saved category and amount', async () => {
    await dashboardPage.reloadExpenses(spending, 1);
    await expect(row.getByRole('cell', { name: category, exact: true })).toBeVisible();
    await expect(row.getByRole('cell', { name: '12,34', exact: true })).toBeVisible();
  });

  // 5. Swipe to delete
  await test.step('Drag the expense row to the right to delete it', async () => {
    const [deleted] = await Promise.all([waitForWrite(page, spreadsheetId, 'deleteDimension'), dashboardPage.deleteExpense(comment)]);
    expect(deleted.ok(), `Delete test expense (HTTP ${deleted.status()})`).toBeTruthy();
  });

  // 6. Deletion after reload
  await test.step('Check that the expense is absent before and after a reload', async () => {
    await expect(row).toHaveCount(0);
    await dashboardPage.reloadExpenses(spending, 0);
    await expect(row).toHaveCount(0);
  });
});

test('an offline expense syncs exactly once after reconnecting', async ({ page, dashboardPage, context, spending }) => {
  test.setTimeout(90_000);
  const { spreadsheetId, comment } = spending;
  const row = dashboardPage.expense(comment);

  // 1. Prepare the form while online
  await test.step('Open the dashboard and load a category', async () => {
    await page.goto('./#/dashboard');
    await dashboardPage.selectExpenseCategory();
  });

  // 2. Offline entry
  await test.step('Disconnect and check that the expense is queued', async () => {
    await context.setOffline(true);
    await dashboardPage.addExpense('12.34', comment);
    await expect(row.getByRole('img', { name: 'Not sent yet' })).toBeVisible();
  });

  // 3. Automatic sync
  await test.step('Reconnect and wait for the queued expense to reach Google Sheets', async () => {
    const [saved] = await Promise.all([waitForWrite(page, spreadsheetId, 'insertDimension'), context.setOffline(false)]);
    expect(saved.ok(), `Sync expense (HTTP ${saved.status()})`).toBeTruthy();
    await expect(page.getByRole('button', { name: /Send now/i })).toHaveCount(0);
  });

  // 4. Stored expense
  await test.step('Reload and check that the sheet and dashboard each contain one matching row', async () => {
    await dashboardPage.reloadExpenses(spending, 1);
    await expect(row).toHaveCount(1);
    await expect(row.getByRole('img', { name: 'Not sent yet' })).toHaveCount(0);
  });
});

function waitForWrite(page: Page, spreadsheetId: string, operation: 'insertDimension' | 'deleteDimension') {
  const batchUpdate = `https://content-sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  return page.waitForResponse(
    response =>
      response.request().method() === 'POST' &&
      response.url().startsWith(batchUpdate) &&
      response
        .request()
        .postDataJSON()
        ?.requests?.some((item: Record<string, unknown>) => operation in item),
  );
}
