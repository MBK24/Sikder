import { expect, test } from "@playwright/test";
import { deliverSubscriptionWebhook, open, signUp } from "./helpers";

const PREMIUM_CHAPTER = "/cp/acids-and-bases";
const REAL_STRIPE = process.env.E2E_STRIPE === "1";

test("signup → checkout → access paid content", async ({ page }) => {
  // 1. A new student signs up and hits the paywall on a premium chapter.
  const email = await signUp(page, "E2E Student");
  await open(page, PREMIUM_CHAPTER);
  await expect(page.getByRole("heading", { name: "Keep reading with Premium" })).toBeVisible();
  const gatedHeading = page.locator("#chapter-body h2", { hasText: "Buffers and the Henderson" });
  await expect(gatedHeading).toHaveCount(0);

  // 2. Start the free trial from the pricing page.
  await open(page, "/pricing");
  await page.locator("form").filter({ has: page.locator('input[name="tier"][value="PREMIUM"]') }).getByRole("button").click();

  if (REAL_STRIPE) {
    // Real Stripe test-mode Checkout (needs `stripe listen` forwarding to this server).
    await page.waitForURL(/checkout\.stripe\.com/);
    await page.getByLabel("Card number").fill("4242 4242 4242 4242");
    await page.getByLabel("Expiration").fill("12 / 34");
    await page.getByLabel("CVC").fill("123");
    await page.getByLabel("Cardholder name").fill("E2E Student");
    await page.getByTestId("hosted-payment-submit-button").click();
    await page.waitForURL(/\/checkout\/success/, { timeout: 45_000 });
    await expect(page.getByRole("heading", { name: /Welcome to Premium|Thanks for subscribing/ })).toBeVisible();
  } else {
    // Without Stripe keys the button can't reach Stripe; deliver the webhook Stripe would send.
    await expect(page).toHaveURL(/pricing\?error=not-configured|checkout\.stripe\.com/);
    await deliverSubscriptionWebhook(email, "trialing");
  }

  // 3. The whole chapter is now readable, including its gated inline questions.
  await open(page, PREMIUM_CHAPTER);
  await expect(page.getByRole("heading", { name: "Keep reading with Premium" })).toHaveCount(0);
  await expect(gatedHeading).toHaveCount(1);
  await expect(page.locator(".paywalled .question-card").first()).toBeVisible();
  await expect(page.getByText("resists changes in pH when small amounts of acid or base are added")).toBeVisible();

  // 4. Billing shows the trial; premium-only practice is unlocked.
  await open(page, "/account/billing");
  await expect(page.getByText(/Free trial until/)).toBeVisible();
  await open(page, "/practice/test");
  await expect(page.getByText("Section tests are part of Premium")).toHaveCount(0);

  // 5. Canceling ends access again.
  if (!REAL_STRIPE) {
    await deliverSubscriptionWebhook(email, "canceled");
    await open(page, PREMIUM_CHAPTER);
    await expect(page.getByRole("heading", { name: "Keep reading with Premium" })).toBeVisible();
  }
});

test("anonymous HTML never contains gated text", async ({ request }) => {
  const html = await (await request.get(PREMIUM_CHAPTER)).text();
  expect(html).toContain("Keep reading with Premium");
  // The H2 is in the public table of contents, but its section body must not be.
  expect(html).not.toContain("resists changes in pH when small amounts of acid or base are added");
});
