import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // Keep local browser QA modest on the shared development PC.
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5178', browserName: 'chromium' },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5178 --strictPort',
    url: 'http://127.0.0.1:5178',
    reuseExistingServer: false,
    // Same-origin API whatever a developer's .env says, so tests can read every response header
    // (a cross-origin API hides headers such as Retry-After from the page).
    env: { VITE_API_URL: 'http://127.0.0.1:5178' }
  }
});
