/**
 * Brand + site-wide settings. Renaming the product is a one-line change here.
 */
export const siteConfig = {
  name: "[YOUR BRAND NAME]",
  shortName: "MCAT Book",
  tagline: "A complete, readable guide to the MCAT",
  description:
    "A free-to-start online MCAT textbook with practice questions, spaced-repetition flashcards, analytics, and a community of verified tutors.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  repo: "https://github.com/MBK24/Sikder",
  locale: "en_US",
} as const;
