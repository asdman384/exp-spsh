import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/login.page';

interface AppFixtures {
  loginPage: LoginPage;
}

export const test = base.extend<AppFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
});

export { expect } from '@playwright/test';
