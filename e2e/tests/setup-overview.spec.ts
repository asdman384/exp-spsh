/// <reference types="gapi.client.sheets-v4" />
import type { Page } from '@playwright/test';
import { REDIRECT_TOKEN, USER } from '../../src/constants/local-storage-keys';
import { Token } from '../../src/shared/models/token';
import { expect, test } from '../fixtures/test';

test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ context, baseURL }) => {
  await context.setStorageState({
    cookies: [],
    origins: [
      {
        origin: new URL(baseURL!).origin,
        localStorage: [
          { name: USER, value: JSON.stringify({ name: 'Alex' }) },
          { name: REDIRECT_TOKEN, value: JSON.stringify(new Token({ access_token: 'overview-test', expires_in: '3600' })) },
        ],
      },
    ],
  });
});

async function setupFile(page: Page, loseCreateResponse = false) {
  const spreadsheetId = 'overview-test';
  const sheets: gapi.client.sheets.Sheet[] = [];
  const reportWrites: string[] = [];
  await page.route('https://sheets.googleapis.com/v4/spreadsheets?**', route => route.fulfill({ json: { spreadsheetId } }));
  await page.route('https://content-sheets.googleapis.com/v4/spreadsheets/overview-test**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET') {
      const json = path.includes('/values/') ? { values: [] } : { spreadsheetId, sheets };
      return route.fulfill({ json });
    }
    const { requests } = request.postDataJSON() as gapi.client.sheets.BatchUpdateSpreadsheetRequest;
    const add = requests?.find(r => r.addSheet)?.addSheet?.properties;
    if (add) {
      const properties = { sheetId: sheets.length + 10, ...add };
      if (add.title === 'Overview') {
        reportWrites.push('create');
        const tag = requests?.find(r => r.createDeveloperMetadata)?.createDeveloperMetadata?.developerMetadata;
        expect(tag).toBeDefined();
        expect(requests?.filter(r => r.addChart)).toHaveLength(1);
        sheets.push({ properties, developerMetadata: [tag!] });
        if (loseCreateResponse) return route.abort('failed');
      } else {
        sheets.push({ properties });
      }
      return route.fulfill({ json: { replies: [{ addSheet: { properties } }] } });
    }
    if (requests?.some(r => r.updateCells)) {
      expect(requests).toHaveLength(1);
      expect(requests[0].updateCells).toMatchObject({
        range: { sheetId: sheets.find(sheet => sheet.properties?.title === 'Overview')?.properties?.sheetId, startColumnIndex: 3, endColumnIndex: 4 },
        fields: 'userEnteredValue',
      });
      reportWrites.push('refresh');
    }
    return route.fulfill({ json: {} });
  });
  await page.route('https://docs.google.com/a/google.com/spreadsheets/d/overview-test/gviz/tq?**', route =>
    route.fulfill({ contentType: 'text/plain', body: 'google.visualization.Query.setResponse({"table":{"rows":[]}});' }),
  );
  await page.goto('./#/setup/settings');
  await page.getByRole('button', { name: 'Create a new spreadsheet for me' }).click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  return reportWrites;
}

test('Finish opens the dashboard without creating Overview', async ({ page }) => {
  const writes = await setupFile(page);
  await expect(page.getByRole('button', { name: 'Add Overview' })).toBeVisible();
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page).toHaveURL(/#\/dashboard/);
  expect(writes).toEqual([]);
});

for (const lostResponse of [false, true]) {
  test(lostResponse ? 'Retry finds the committed Overview after a lost response' : 'Add Overview works after Skip', async ({ page }) => {
    const writes = await setupFile(page, lostResponse);
    await page.getByRole('button', { name: 'Add Overview' }).click();
    if (lostResponse) {
      await expect(page.getByRole('button', { name: 'Finish' })).toBeEnabled();
      await page.getByRole('button', { name: 'Retry report' }).click();
    }
    await expect(page.getByText('Overview is ready.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Overview' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Finish' }).click();
    await expect(page).toHaveURL(/#\/dashboard/);
    expect(writes).toEqual(lostResponse ? ['create', 'refresh'] : ['create']);
  });
}
