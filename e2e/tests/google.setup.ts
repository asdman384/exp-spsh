import { rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { expect, test } from '../fixtures/test';
import { authFile, readCredentials } from '../auth/state';
import { REDIRECT_TOKEN, REFRESH_TOKEN } from '../../src/constants/local-storage-keys';
import { Token } from '../../src/shared/models/token';

test('prepare a Google session for authenticated tests', async ({ loginPage, context, request, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const { access_token, refresh_token } = await readCredentials(origin);
  const info = await request
    .post('https://oauth2.googleapis.com/tokeninfo', {
      headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      maxRedirects: 0,
      timeout: 15_000,
    })
    .catch(() => {
      // Request errors can include headers. Keep credentials out of the test report.
      throw new Error('Could not reach the Google token verification endpoint.');
    });
  let lifetime = 0;
  if (info.ok()) {
    lifetime = Number((await info.json()).expires_in);
    if (!Number.isFinite(lifetime)) throw new Error('Google returned no access token lifetime.');
  } else if (!(info.status() === 401 || (info.status() === 400 && (await info.json()).error === 'invalid_token'))) {
    throw new Error(`Google token verification failed (HTTP ${info.status()}).`);
  }

  // An expired token triggers the same refresh flow as a returning app user.
  const token = new Token({ access_token, expires_in: String(lifetime) });
  await context.setStorageState({
    cookies: [],
    origins: [
      {
        origin,
        localStorage: [
          { name: REDIRECT_TOKEN, value: JSON.stringify(token) },
          { name: REFRESH_TOKEN, value: JSON.stringify({ refresh_token }) },
        ],
      },
    ],
  });
  await loginPage.openApplication();
  const [result] = await Promise.all([
    loginPage.page.waitForResponse(
      r =>
        r.request().method() !== 'OPTIONS' &&
        (r.url() === 'https://content.googleapis.com/oauth2/v2/userinfo' || (r.url() === 'https://oauth2.googleapis.com/token' && !r.ok())),
      { timeout: 30_000 },
    ),
    loginPage.signIn(),
  ]);
  if (!result.ok()) {
    if (result.status() === 400 && (await result.json()).error === 'invalid_grant') {
      throw new Error('Google rejected the refresh token. Update e2e/google-tokens.local.json for the OAuth client in keys.json.');
    }
    throw new Error(`Google sign-in failed (HTTP ${result.status()}).`);
  }
  await expect(loginPage.page).toHaveURL(url => url.origin === origin && url.hash.split('?')[0] === '#/setup/settings');
  const temp = authFile + '.' + randomUUID();
  try {
    await context.storageState({ path: temp });
    await rename(temp, authFile);
  } finally {
    await rm(temp, { force: true });
  }
});
