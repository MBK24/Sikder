import { expect, test } from "@playwright/test";
import { open, signIn } from "./helpers";

test("post question → tutor replies", async ({ browser }) => {
  const title = `E2E: why is Vmax unchanged by competitive inhibitors? ${Date.now()}`;

  // A Premium student asks a question from a chapter, with LaTeX.
  const studentCtx = await browser.newContext();
  const student = await studentCtx.newPage();
  await signIn(student, "student@example.com");
  await open(student, "/forum/new?chapter=enzymes-and-kinetics&category=bio-biochem");
  await student.getByLabel("Title").fill(title);
  await student.getByLabel("Tags (up to 5)").fill("enzymes");
  await student.getByLabel("Details").fill("I see that $K_m$ rises, but why does $V_{max}$ stay the same? I tried reasoning from $\\ce{E + S <=> ES}$.");
  await student.getByRole("button", { name: "Post question" }).click();
  await student.waitForURL(/\/forum\/p\//);
  const postUrl = student.url();
  await expect(student.locator("article .katex").first()).toBeVisible();

  // A verified tutor finds it and answers.
  const tutorCtx = await browser.newContext();
  const tutor = await tutorCtx.newPage();
  await signIn(tutor, "tutor@example.com");
  await open(tutor, "/forum/chapter/enzymes-and-kinetics");
  await tutor.getByRole("link", { name: title }).click();
  await tutor.waitForLoadState("networkidle");
  await tutor.getByRole("textbox", { name: "Your answer" }).fill(
    "At very high substrate concentration the substrate outcompetes the inhibitor, so the enzyme still reaches full speed. Only the apparent $K_m$ rises.",
  );
  await tutor.getByRole("button", { name: "Post answer" }).click();
  await expect(tutor.locator(".answer-verified")).toHaveCount(1);

  // The student is notified, sees the highlighted tutor answer, upvotes and accepts it.
  await open(student, "/notifications");
  await expect(student.getByRole("link", { name: `A verified tutor answered “${title}”`, exact: true })).toBeVisible();
  await open(student, postUrl);
  const answer = student.locator('li[id^="reply-"]').first();
  await expect(answer.getByText("Answer from a verified tutor")).toBeVisible();
  await answer.getByRole("button", { name: "Upvote" }).click();
  await expect(answer.getByLabel("1 votes")).toBeVisible();
  await answer.getByRole("button", { name: "✓ Accept this answer" }).click();
  await expect(student.locator(".answer-accepted")).toHaveCount(1);

  await studentCtx.close();
  await tutorCtx.close();
});

test("free users can read but not post", async ({ page }) => {
  await signIn(page, "free@example.com");
  await open(page, "/forum/new");
  await expect(page.getByText("Asking and answering is part of Premium")).toBeVisible();
});
