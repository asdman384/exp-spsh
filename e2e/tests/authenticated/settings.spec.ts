import { expect, test } from '../../fixtures/test';

test('a signed-in user can open spreadsheet settings', async ({ page }) => {
  await page.goto('./#/setup/settings');
  await expect(page.getByRole('button', { name: 'Choose existing', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/#\/setup\/settings$/);
});
