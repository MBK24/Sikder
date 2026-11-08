import { expect, type Page } from "@playwright/test";
import Stripe from "stripe";
import pg from "pg";
import { BASE_URL, E2E_WEBHOOK_SECRET } from "../../playwright.config";

export const PASSWORD = "password1234";

/** Navigate and wait for streamed sections to settle (React swaps streamed content in from a hidden slot). */
export async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/sign-in");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"));
}

export async function signUp(page: Page, name: string) {
  const email = `e2e+${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;
  await page.goto("/sign-up");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("e2e-password-123");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/sign-up"));
  return email;
}

export async function withDb<T>(fn: (db: pg.Client) => Promise<T>) {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}

/**
 * Delivers a correctly signed Stripe webhook for a subscription, exactly as Stripe would.
 * Used when real Stripe test keys aren't available (the default in CI).
 */
export async function deliverSubscriptionWebhook(email: string, status: "trialing" | "active" | "past_due" | "canceled", lookupKey = "premium_monthly") {
  const userId = await withDb(async (db) => (await db.query(`select id from "User" where email = $1`, [email])).rows[0]?.id as string);
  expect(userId, `user ${email} exists`).toBeTruthy();
  const now = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({
    id: `evt_e2e_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    object: "event",
    type: status === "canceled" ? "customer.subscription.deleted" : "customer.subscription.updated",
    data: {
      object: {
        id: `sub_e2e_${userId}`,
        object: "subscription",
        status,
        customer: `cus_e2e_${userId}`,
        cancel_at_period_end: false,
        cancel_at: null,
        canceled_at: status === "canceled" ? now : null,
        trial_end: status === "trialing" ? now + 7 * 86400 : null,
        metadata: { userId },
        items: {
          object: "list",
          data: [{ id: "si_e2e", current_period_start: now, current_period_end: now + 30 * 86400, price: { id: "price_e2e", lookup_key: lookupKey, recurring: { interval: "month" } } }],
        },
      },
    },
  });
  const header = await new Stripe("sk_test_unused").webhooks.generateTestHeaderStringAsync({ payload, secret: E2E_WEBHOOK_SECRET });
  const res = await fetch(`${BASE_URL}/api/stripe/webhook`, { method: "POST", body: payload, headers: { "stripe-signature": header, "content-type": "application/json" } });
  expect(res.status, await res.text()).toBe(200);
}
