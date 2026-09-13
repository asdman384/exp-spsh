import { HttpErrorResponse } from '@angular/common/http';

import { classifyWriteError } from './index';

const SHEETS_URL = 'https://content-sheets.googleapis.com/v4/spreadsheets/abc:batchUpdate';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

// [AC12] one test per D3 row, with the exact cases the spec lists.
describe('[AC12] classifyWriteError', () => {
  it('should_classify_a_plain_string_as_terminal', () => {
    expect(classifyWriteError('boom')).toBe('terminal');
  });

  it('should_classify_a_plain_Error_as_terminal', () => {
    expect(classifyWriteError(new Error('boom'))).toBe('terminal');
  });

  it('should_classify_undefined_as_terminal', () => {
    expect(classifyWriteError(undefined)).toBe('terminal');
  });

  it('should_classify_status_0_on_a_sheets_url_as_retryable', () => {
    const e = new HttpErrorResponse({ status: 0, url: SHEETS_URL });
    expect(classifyWriteError(e)).toBe('retryable');
  });

  it('should_classify_status_0_on_the_token_url_as_retryable', () => {
    const e = new HttpErrorResponse({ status: 0, url: TOKEN_URL });
    expect(classifyWriteError(e)).toBe('retryable');
  });

  it('should_classify_a_400_on_the_token_url_as_auth', () => {
    const e = new HttpErrorResponse({ status: 400, url: TOKEN_URL });
    expect(classifyWriteError(e)).toBe('auth');
  });

  it('should_classify_a_503_on_the_token_url_as_retryable', () => {
    const e = new HttpErrorResponse({ status: 503, url: TOKEN_URL });
    expect(classifyWriteError(e)).toBe('retryable');
  });

  it('should_classify_401_as_auth', () => {
    const e = new HttpErrorResponse({ status: 401, url: SHEETS_URL });
    expect(classifyWriteError(e)).toBe('auth');
  });

  it.each([408, 429, 500, 503])('should_classify_status_%i_on_a_sheets_url_as_retryable', (status) => {
    const e = new HttpErrorResponse({ status, url: SHEETS_URL });
    expect(classifyWriteError(e)).toBe('retryable');
  });

  it.each([400, 403, 404])('should_classify_status_%i_on_a_sheets_url_as_terminal', (status) => {
    const e = new HttpErrorResponse({ status, url: SHEETS_URL });
    expect(classifyWriteError(e)).toBe('terminal');
  });

  it('should_classify_status_200_as_terminal', () => {
    const e = new HttpErrorResponse({ status: 200, url: SHEETS_URL });
    expect(classifyWriteError(e)).toBe('terminal');
  });
});
