import { expect, test } from '../fixtures/test';
import { CATEGORIES_SHEET_ID, DATA_SHEETS, REDIRECT_TOKEN, SPREADSHEET_ID, USER } from '../../src/constants/local-storage-keys';
import { Token } from '../../src/shared/models/token';

test.use({ serviceWorkers: 'block', locale: 'en-US' });

function expense(category: string, comment: string, amount: number, date: string, debt = false) {
  return { c: [{ v: category }, { v: comment }, { v: amount }, { v: date }, debt ? { v: 1 } : null] };
}

const januaryRows = [
  expense('Food', 'December groceries', 30, 'Date(2024,11,31,12,0,0)'),
  expense('Food', 'Bread', 20, 'Date(2025,0,1,12,0,0)'),
  expense('Travel', 'Train', 40, 'Date(2025,0,4,12,0,0)'),
  expense('Food', 'Dinner', 40, 'Date(2025,0,8,12,0,0)', true),
];

test.beforeEach(async ({ page, context, baseURL }) => {
  await page.clock.install({ time: new Date('2025-01-15T12:00:00Z') });
  const token = new Token({ access_token: 'statistics-test', expires_in: '3600' });
  token.expiration = Date.parse('2025-01-15T13:00:00Z');
  await context.setStorageState({
    cookies: [],
    origins: [
      {
        origin: new URL(baseURL!).origin,
        localStorage: [
          { name: USER, value: JSON.stringify({ name: 'Alex' }) },
          { name: REDIRECT_TOKEN, value: JSON.stringify(token) },
          { name: SPREADSHEET_ID, value: JSON.stringify('statistics-test') },
          { name: CATEGORIES_SHEET_ID, value: '1' },
          {
            name: DATA_SHEETS,
            value: JSON.stringify([
              { id: 2, title: 'data_Alex' },
              { id: 3, title: 'data_Sam' },
            ]),
          },
        ],
      },
    ],
  });
  await page.route('https://docs.google.com/a/google.com/spreadsheets/d/statistics-test/gviz/tq?**', async route => {
    const params = new URL(route.request().url()).searchParams;
    const range = params.get('tq');
    const sheet = params.get('gid');
    let rows: typeof januaryRows;
    if (range?.includes("D >= date '2024-12-1' and D < date '2025-2-1'") && sheet === '2') {
      rows = januaryRows;
    } else if (range?.includes("D >= date '2024-12-1' and D < date '2025-2-1'") && sheet === '3') {
      rows = [expense('Books', 'Atlas', 12, 'Date(2025,0,3,12,0,0)')];
    } else if (range?.includes("D >= date '2025-2-1' and D < date '2025-4-1'") && sheet === '2') {
      rows = [];
    } else {
      throw new Error(`Unexpected statistics query for sheet ${sheet}: ${range}`);
    }
    await route.fulfill({
      contentType: 'text/plain',
      body: `google.visualization.Query.setResponse(${JSON.stringify({ table: { rows } })});`,
    });
  });
  await page.goto('./#/dashboard/statistics');
});

test('January spending compares with December and updates when a category is unchecked', async ({ statisticsPage: stats }) => {
  await expect(stats.summary).toHaveText(/Spending ·\s*100\s*Debt · 40/);
  const food = stats.categoryRow('Food');
  await expect(food).toContainText(/60\s*60%\s*\+30\s*↑/);
  await expect(stats.categoryRow('Travel')).toContainText(/40\s*40%\s*\+40\s*↑/);
  await food.getByRole('checkbox').uncheck();
  await expect(stats.summary).toHaveText(/Spending ·\s*40\s*Debt · 40/);
  await expect(food).toContainText('60%');
});

test('category details show only current expenses, newest first, and Back restores the summary', async ({
  page,
  statisticsPage: stats,
}) => {
  await stats.cell('Food').click();
  await expect(stats.summary).toContainText(/Food\s*60/);
  const details = page.getByRole('row').filter({ has: page.getByRole('cell') });
  await expect(details).toHaveText([/40.*Dinner/, /20.*Bread/]);
  await stats.back.click();
  await expect(stats.summary).toHaveText(/Spending ·\s*100\s*Debt · 40/);
  await expect(stats.categoryRow('Food').getByRole('checkbox')).toBeChecked();
});

test('changing the person or month replaces the results and closes category details', async ({ page, statisticsPage: stats }) => {
  await stats.cell('Food').click();
  await expect(stats.back).toBeVisible();
  await stats.tab('Sam').click();
  await expect(stats.summary).toHaveText(/Spending ·\s*12\s*Debt · 0/);
  await expect(stats.cell('Books')).toBeVisible();
  await expect(stats.back).toHaveCount(0);
  await stats.tab('Alex').click();
  await expect(stats.cell('Food')).toBeVisible();
  await stats.tab('Mar').click();
  await expect(page.getByText('No entries for this view.', { exact: true })).toBeVisible();
  await expect(stats.summary).toHaveText(/Spending ·\s*0\s*Debt · 0/);
  await expect(page.getByRole('cell')).toHaveCount(0);
});
