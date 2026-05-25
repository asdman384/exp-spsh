/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  // Vitest configuration object
  // See https://vitest.dev/config/ for configuration options
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [],
    browser: {
      screenshotFailures: false
    }
  }
});
