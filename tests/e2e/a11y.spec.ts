import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/** Automated WCAG 2 A/AA checks on key pages, in both themes. Fails on serious or critical issues. */
const PAGES = ["/", "/cp/atoms-and-periodic-trends", "/cp/acids-and-bases", "/pricing", "/forum", "/practice", "/sign-in", "/search?q=buffer"];

for (const theme of ["light", "dark"] as const) {
  for (const path of PAGES) {
    test(`a11y ${theme}: ${path}`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        // KaTeX's hidden MathML duplicate is intentionally aria-hidden alongside visible HTML math.
        .exclude(".katex-mathml")
        .analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(
        serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length}) e.g. ${v.nodes[0]?.target.join(" ")}`),
        `${theme} ${path}`,
      ).toEqual([]);
    });
  }
}

test("mobile: the chapter drawer opens and navigates", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto("/cp/atoms-and-periodic-trends");
  await page.getByRole("button", { name: "Open table of contents" }).click();
  const drawer = page.getByRole("dialog", { name: "Book contents" });
  await expect(drawer).toBeVisible();
  await drawer.getByRole("link", { name: "How the MCAT Is Scored" }).click();
  await expect(page).toHaveURL(/how-the-mcat-is-scored/);
  await expect(drawer).toBeHidden();
  // No horizontal page scroll at phone width.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await ctx.close();
});
