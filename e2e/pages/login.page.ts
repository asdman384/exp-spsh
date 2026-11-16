import { type Locator, type Page } from '@playwright/test';

export class LoginPage {
  readonly signInButton: Locator;

  constructor(readonly page: Page) {
    this.signInButton = page.getByRole('button', { name: 'Google Sign In', exact: true });
  }

  async openApplication(): Promise<void> {
    // Enter through the app root so the test exercises the authentication guard.
    await this.page.goto('./');
  }
}
