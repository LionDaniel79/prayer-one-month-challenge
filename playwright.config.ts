import { defineConfig, devices } from "@playwright/test";

// Playwright's API client permits Secure cookies on localhost, as Chromium does.
// Numeric loopback addresses do not get that exception in APIRequestContext.
const baseURL = "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  // The database-backed flows share a deliberately small synthetic fixture.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run start -- --hostname localhost",
    url: `${baseURL}/login`,
    // Verify the production build; never silently reuse a development server.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
