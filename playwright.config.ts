import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:3100",
    browserName: "chromium",
    headless: true,
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run start -- --port 3100 --hostname 127.0.0.1",
    url: "http://127.0.0.1:3100/en",
    timeout: 90000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: "",
      RESEND_API_KEY: "",
      VERCEL: "",
      CF_PAGES: "",
      WORKERS_CI: "",
      LUNE_DEPLOYMENT: "",
      ADMIN_PASSWORD: "local-playwright-fixture-only",
    },
  },
});
