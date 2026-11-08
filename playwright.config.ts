import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";

/**
 * End-to-end tests run against a PRODUCTION build (`pnpm build` first) with a seeded DB (`pnpm db:seed`).
 *   pnpm test:e2e
 * Stripe: without real test keys, checkout is simulated with a signed webhook (same code path as Stripe).
 * Set E2E_STRIPE=1 plus real STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET (and `stripe listen`) to drive real Checkout.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
export const BASE_URL = `http://localhost:${PORT}`;
export const E2E_WEBHOOK_SECRET = process.env.E2E_STRIPE === "1" ? process.env.STRIPE_WEBHOOK_SECRET! : "whsec_e2e_test_secret";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: BASE_URL, trace: "off", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      BETTER_AUTH_URL: BASE_URL,
      AUTH_RATE_LIMIT: "0",
      // Without E2E_STRIPE, Stripe is "not configured" and checkout is simulated by a signed webhook.
      STRIPE_SECRET_KEY: process.env.E2E_STRIPE === "1" ? process.env.STRIPE_SECRET_KEY! : "",
      STRIPE_WEBHOOK_SECRET: E2E_WEBHOOK_SECRET,
    },
  },
});
