import { expect, test } from '../fixtures/test';

// Keep this suite signed out if authenticated projects are added later.
test.use({ storageState: { cookies: [], origins: [] } });

test('a signed-out user sees the login page when opening the app', async ({ loginPage }) => {
  await loginPage.openApplication();

  await expect(loginPage.page).toHaveURL(/\/exp-spsh\/#\/setup\/login$/);
  await expect(loginPage.page).toHaveTitle('Expenses');
  await expect(loginPage.signInButton).toBeVisible();
  await expect(loginPage.signInButton).toBeEnabled();
});
