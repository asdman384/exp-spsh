import type { APIRequestContext, BrowserContext } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  CATEGORIES_SHEET_ID,
  DATA_SHEETS,
  REDIRECT_TOKEN,
  REFRESH_TOKEN,
  SPREADSHEET_ID,
  USER,
} from '../../src/constants/local-storage-keys';
import { CATEGORIES_SHEET_TITLE, DATA_SHEET_TITLE_PREFIX } from '../../src/constants/spreadsheets';
import { Token } from '../../src/shared/models/token';

export const authFile = resolve('tmp/playwright-auth/google.json');
type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>;

interface E2EConfig {
  access_token: string;
  refresh_token: string;
  spreadsheetId?: string;
  categoriesSheetId?: number;
  dataSheetId?: number;
}

async function readConfig(): Promise<E2EConfig> {
  const path = resolve('e2e/google-tokens.local.json');
  let configured;
  try {
    configured = JSON.parse(await readFile(path, 'utf8'));
  } catch {
    throw new Error('Create e2e/google-tokens.local.json from google-tokens.example.json and enter the test account tokens.');
  }
  if (![configured?.access_token, configured?.refresh_token].every(value => typeof value === 'string' && value.trim())) {
    throw new Error('The private E2E config requires access_token and refresh_token.');
  }
  return configured;
}

export async function readCredentials(origin: string): Promise<{ access_token: string; refresh_token: string }> {
  const configured = await readConfig();
  // A new refresh token selects a new grant. Ignore the previous account's state.
  try {
    const state: StorageState = JSON.parse(await readFile(authFile, 'utf8'));
    const entries = state.origins.find(entry => entry.origin === origin)?.localStorage ?? [];
    const saved = (key: string) => JSON.parse(entries.find(entry => entry.name === key)?.value ?? 'null');
    if (saved(REFRESH_TOKEN)?.refresh_token === configured.refresh_token) {
      const token: Token | null = saved(REDIRECT_TOKEN);
      if (token && token.expiration > Date.now() && typeof token.googleToken?.access_token === 'string') {
        return { access_token: token.googleToken.access_token, refresh_token: configured.refresh_token };
      }
    }
  } catch (error) {
    if (!(error instanceof SyntaxError || error instanceof TypeError || (error as NodeJS.ErrnoException).code === 'ENOENT')) throw error;
  }
  return configured;
}

export async function prepareSpendingSpreadsheet(context: BrowserContext, request: APIRequestContext, origin: string): Promise<string> {
  const { spreadsheetId, categoriesSheetId, dataSheetId } = await readConfig();
  if (
    typeof spreadsheetId !== 'string' ||
    !/^[\w-]+$/.test(spreadsheetId) ||
    ![categoriesSheetId, dataSheetId].every(id => typeof id === 'number' && Number.isSafeInteger(id) && id >= 0) ||
    categoriesSheetId === dataSheetId
  ) {
    throw new Error(
      'Set spreadsheetId and two distinct numeric tab IDs (categoriesSheetId and dataSheetId) in e2e/google-tokens.local.json.',
    );
  }

  const state = await context.storageState();
  const storage = state.origins.find(entry => entry.origin === origin)?.localStorage;
  const stored = (name: string) => JSON.parse(storage?.find(entry => entry.name === name)?.value ?? 'null');
  const name = stored(USER)?.name;
  const token = stored(REDIRECT_TOKEN)?.googleToken?.access_token;
  if (!storage || !name || !token) throw new Error('The spending test requires the Google setup project.');

  const metadata = await request
    .get(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { fields: 'sheets(properties(sheetId,title))' },
      maxRedirects: 0,
    })
    .catch(() => {
      throw new Error('Could not read the test spreadsheet metadata.');
    });
  if (!metadata.ok()) throw new Error(`Cannot read the configured spreadsheet (HTTP ${metadata.status()}). Check the test account grant.`);
  const { sheets } = (await metadata.json()) as { sheets: { properties: { sheetId: number; title: string } }[] };
  const title = DATA_SHEET_TITLE_PREFIX + name;
  if (
    !sheets.some(({ properties: p }) => p.sheetId === categoriesSheetId && p.title === CATEGORIES_SHEET_TITLE) ||
    !sheets.some(({ properties: p }) => p.sheetId === dataSheetId && p.title === title)
  )
    throw new Error('Check the configured tab IDs for categories and the signed-in user’s data sheet.');

  storage.push(
    { name: SPREADSHEET_ID, value: JSON.stringify(spreadsheetId) },
    { name: CATEGORIES_SHEET_ID, value: JSON.stringify(categoriesSheetId) },
    { name: DATA_SHEETS, value: JSON.stringify([{ id: dataSheetId, title }]) },
  );
  await context.setStorageState(state);
  return spreadsheetId;
}
