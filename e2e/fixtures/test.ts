import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { prepareTestSpreadsheet } from '../auth/state';
import { CategoriesPage } from '../pages/categories.page';
import { StatisticsPage } from '../pages/statistics.page';
import { randomUUID } from 'node:crypto';

interface AppFixtures {
  statisticsPage: StatisticsPage;
  categoriesPage: CategoriesPage;
  categoryData: { spreadsheetId: string; first: string; second: string };
  spending: { spreadsheetId: string; dataSheetId: number; comment: string };
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
}

export const test = base.extend<AppFixtures>({
  statisticsPage: async ({ page }, use) => {
    await use(new StatisticsPage(page));
  },
  spending: async ({ context, page, request, baseURL }, use) => {
    const sheet = await prepareTestSpreadsheet(context, request, new URL(baseURL!).origin);
    const comment = `E2E spending ${randomUUID()}`;
    try {
      await use({ spreadsheetId: sheet.spreadsheetId, dataSheetId: sheet.dataSheetId, comment });
    } finally {
      // Stop the outbox before checking the remote sheet for a lost write response.
      try {
        await page.close();
      } finally {
        await sheet.removeTestRows('spending', [comment]);
      }
    }
  },
  categoriesPage: async ({ page }, use) => {
    await use(new CategoriesPage(page));
  },
  categoryData: async ({ context, request, baseURL }, use) => {
    const sheet = await prepareTestSpreadsheet(context, request, new URL(baseURL!).origin);
    const suffix = randomUUID();
    const first = `E2E A ${suffix}`;
    const second = `E2E B ${suffix}`;
    try {
      await use({ spreadsheetId: sheet.spreadsheetId, first, second });
    } finally {
      await sheet.removeTestRows('categories', [first, second]);
    }
  },
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
});

export { expect } from '@playwright/test';
