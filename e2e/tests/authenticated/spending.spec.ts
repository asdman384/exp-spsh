import { randomUUID } from 'node:crypto';
import { prepareSpendingSpreadsheet } from '../../auth/state';
import { expect, test } from '../../fixtures/test';

test.use({ timezoneId: 'Europe/Warsaw' });

test('a signed-in user can add spending for today and delete it', async ({ page, dashboardPage, context, request, baseURL, headless }) => {
  test.setTimeout(90_000);
  const spreadsheetId = await prepareSpendingSpreadsheet(context, request, new URL(baseURL!).origin);
  const today = new Date();
  await page.goto('./#/dashboard');
  await expect(page).toHaveURL(/#\/dashboard$/);
  if (!headless) await page.pause();

  const dateLabel = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(today);
  await expect(page.getByRole('textbox', { name: 'Date', exact: true })).toHaveValue(dateLabel);
  const comment = `E2E spending ${randomUUID()}`;
  const batchUpdate = `https://content-sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  const waitForWrite = (operation: 'insertDimension' | 'deleteDimension') =>
    page.waitForResponse(
      response =>
        response.request().method() === 'POST' &&
        response.url().startsWith(batchUpdate) &&
        response
          .request()
          .postDataJSON()
          ?.requests?.some((item: Record<string, unknown>) => operation in item),
    );

  const category = await dashboardPage.selectExpenseCategory();
  const [saved] = await Promise.all([waitForWrite('insertDimension'), dashboardPage.addExpense('12.34', comment)]);
  expect(saved.ok(), `Save expense (HTTP ${saved.status()})`).toBeTruthy();
  const row = dashboardPage.expense(comment);
  try {
    await expect(row).toHaveCount(1);
    await expect(row.getByRole('img', { name: 'Not sent yet' })).toHaveCount(0);
    await dashboardPage.reloadExpenses(comment, true);
    await expect(row.getByRole('cell', { name: category, exact: true })).toBeVisible();
    await expect(row.getByRole('cell', { name: '12,34', exact: true })).toBeVisible();
  } finally {
    const [deleted] = await Promise.all([waitForWrite('deleteDimension'), dashboardPage.deleteExpense(comment)]);
    expect(deleted.ok(), `Delete test expense (HTTP ${deleted.status()})`).toBeTruthy();
  }
  await expect(row).toHaveCount(0);
  await dashboardPage.reloadExpenses(comment, false);
  await expect(row).toHaveCount(0);
});
