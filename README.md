# MCAT Prep Platform

An online MCAT textbook in the style of [R for Data Science](https://r4ds.hadley.nz/), with inline practice questions, a question bank, spaced-repetition flashcards, analytics, and a tutor-backed forum.

> **Status:** all six build phases are complete. [docs/PROPOSAL.md](docs/PROPOSAL.md) has the architecture, and the sections below cover running, testing, and deploying.

## Stack

Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS v4 · PostgreSQL + Prisma 7 · Better Auth · Stripe · Resend · Vercel Blob · MDX + KaTeX/mhchem · Vitest · Playwright + axe

## Local setup

Requirements: Node 20.19+, pnpm 10, PostgreSQL 14+.

```bash
pnpm install
cp .env.example .env            # then fill in BETTER_AUTH_SECRET (openssl rand -base64 32)
```

Create a database and point `DATABASE_URL` at it. For example, with a local Postgres:

```bash
createuser -P mcat && createdb -O mcat mcat
```

Apply migrations, then seed:

```bash
pnpm prisma migrate deploy
pnpm db:seed
```

Seeding creates the forum categories, badges and demo users, and syncs /content into the DB. Then start the dev server:

```bash
pnpm dev
```

Open http://localhost:3000.

**Demo accounts** (password `password1234`). The seed creates these only when `DATABASE_URL` points at a local database, or when `SEED_DEMO_USERS=1` is set:

| Email | Role |
| --- | --- |
| admin@example.com | Admin |
| tutor@example.com | Verified Tutor |
| expert@example.com | Expert |
| student@example.com | Student with a demo Premium subscription |
| free@example.com | Student on the Free plan |
| plus@example.com | Student with a demo Premium + Tutoring subscription (priority questions, session requests) |

When `RESEND_API_KEY` is not set, emails (verification, password reset, welcome) are printed to the dev-server console. Click the links from there.

Forum image uploads turn on when `BLOB_READ_WRITE_TOKEN` (Vercel Blob) is set. Without it, posts are text, Markdown and LaTeX only.

Google sign-in turns on automatically when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set. The authorized redirect URI is `{BETTER_AUTH_URL}/api/auth/callback/google`.

## Payments (Stripe test mode)

Prices, the trial length, the failed-payment grace period, and what each tier includes all live in `src/config/pricing.ts`.

1. Create a Stripe account and copy your **test** secret key (`sk_test_…`) from Dashboard → Developers → API keys into `STRIPE_SECRET_KEY` in `.env`.
2. Create the products, prices (monthly + annual for each paid tier) and the Customer Portal configuration:

   ```bash
   pnpm stripe:setup
   ```

   It is safe to re-run. After changing a price in `pricing.ts`, run it again: Stripe prices can't be edited, so the script creates a new price and moves the lookup key to it.
3. Forward webhooks to your machine with the [Stripe CLI](https://docs.stripe.com/stripe-cli):

   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

   Put the `whsec_…` value it prints into `STRIPE_WEBHOOK_SECRET`, then restart `pnpm dev`.
4. On `/pricing`, start a trial with the test card `4242 4242 4242 4242` (any future expiry date, any CVC). To try a failed payment, update the card in the billing portal to `4000 0000 0000 0341`.

How it fits together:

- Checkout starts a subscription with a 7-day trial (card required, one trial per account).
- Webhooks keep the `Subscription` table in sync, and access checks read only that table.
- `/account/billing` opens the Stripe Customer Portal for upgrades, downgrades, switching between monthly and annual, and cancellation.
- Failed payments keep access for `PAYMENT_GRACE_DAYS` while Stripe retries.
- Promotion codes can be switched on in `/admin/settings`.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm build` | Validate content → generate Prisma client → production build |
| `pnpm content:check [filter]` | Validate all MDX/YAML in /content (math, components, ids, schemas) |
| `pnpm content:sync` | Upsert /content into the DB (chapters, search index, questions, flashcards) |
| `pnpm db:seed` | Reference data + demo users + content sync |
| `pnpm stripe:setup [--webhook https://site]` | Create/update Stripe products, prices, portal (and webhook endpoint) |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:e2e` | End-to-end + accessibility tests (Playwright) against a production build |
| `pnpm lint` / `pnpm typecheck` | ESLint / TypeScript |

## Writing content

Read [content/AUTHORING.md](content/AUTHORING.md). In short:

- A chapter is one `content/book/<part>/NN-slug.mdx` file.
- Its questions go in `content/questions/<part>/<slug>.yaml` and its flashcards in `content/flashcards/<part>/<slug>.yaml`.
- Run `pnpm content:check` before committing. Deploys run `content:sync` automatically.
- After a chapter is first synced, its free/premium and published status are controlled from the admin dashboard, not frontmatter.

## Project layout

```
content/          study content (MDX + YAML)
prisma/           schema, migrations, seed
scripts/          content check/sync
src/app/          routes: (book) reading, (app) tools, (auth) sign-in
src/components/   book chrome, MDX components, UI
src/server/       server-only: db, auth, content rendering, actions, search, email
src/lib/content/  content schemas + MDX/Markdown pipeline (shared by app and scripts)
src/lib/srs/      SM-2 spaced-repetition scheduler
src/lib/scoring.ts exam-style ordering, scaled estimate, streaks, readiness (unit-tested)
src/config/       site name, MCAT constants, pricing + tier boundaries (pricing.ts), reputation rules (reputation.ts)
tests/unit/       Vitest unit tests
tests/e2e/        Playwright end-to-end + accessibility tests
.github/          CI workflow
```

## Admin

Admins can sign in and open `/admin`. To make an account an admin, add its email to `ADMIN_EMAILS`: new sign-ups with that email become admins, and `pnpm db:seed` promotes existing accounts.

| Page | What it's for |
| --- | --- |
| `/admin` | Signups, paying subscribers and trials by tier, estimated MRR (list prices), studying today, most-missed questions |
| `/admin/content` | Switch chapters between free and paid, publish or unpublish them, set an early-access window. Changes take effect immediately, with no redeploy. |
| `/admin/questions` | Search, create, and edit questions; CSV import (validated as a dry run first, upserts by `key`) and export |
| `/admin/users` | Search users; change roles; grant Verified Tutor; manage badges; view subscriptions; ban |
| `/admin/moderation` | Reported posts and answers, hidden/locked threads, bans, moderator audit log (moderators can open this too) |
| `/admin/verifications` | Review Verified Tutor / Expert applications |
| `/admin/settings` | Promotion-code toggle for Stripe Checkout |

Editing a question that came from `/content` makes it admin-owned, so later content syncs won't overwrite your edit.

## Testing

```bash
pnpm test
```

That runs the unit tests: SM-2 scheduling, scoring, paywall split, billing mapping, Markdown sanitization, CSV import, and more. The end-to-end suite needs a seeded local database and a production build:

```bash
pnpm build
```

```bash
pnpm test:e2e
```

The end-to-end suite covers:

- **Signup → checkout → paid content:** includes the paywall leak check.
- **Post a question → tutor replies:** includes notifications, the vote, and the accepted answer.
- **Mobile navigation:** the chapter drawer at phone width.
- **Accessibility:** WCAG 2.1 AA scans (axe) of key pages in light and dark mode.

Without Stripe keys, checkout is simulated by delivering a correctly signed webhook, which is the same code path Stripe uses. Set `E2E_STRIPE=1` with test keys and `stripe listen` running to drive the real hosted Checkout.

`.github/workflows/ci.yml` runs lint, typecheck, content validation, unit tests, and the end-to-end suite (with a Postgres service) on every push and pull request.

## Deploying (Vercel + Neon)

1. **Database.** Create a [Neon](https://neon.tech) project and copy the **pooled** connection string, which becomes `DATABASE_URL`. Neon branches can give preview deployments their own database.
2. **Vercel project.** Import the GitHub repo into [Vercel](https://vercel.com/new). The framework is detected automatically. Vercel runs `pnpm vercel-build`, which:
   - generates the Prisma client;
   - applies migrations;
   - validates and syncs `/content`;
   - builds the site.
3. **Environment variables** (Project → Settings → Environment Variables):

   | Variable | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SITE_URL`, `BETTER_AUTH_URL` | Your production URL, e.g. `https://example.com` |
   | `DATABASE_URL` | Neon pooled connection string |
   | `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
   | `ADMIN_EMAILS` | Your email (comma-separated list) |
   | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | See step 5 |
   | `RESEND_API_KEY`, `EMAIL_FROM` | See step 6 |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional, for Google sign-in (redirect URI `https://<domain>/api/auth/callback/google`) |
   | `BLOB_READ_WRITE_TOKEN` | Optional: create a Vercel Blob store (Storage tab) to enable forum image uploads |

4. **Seed reference data once** (forum categories, badges, tags, content). From your machine, with `DATABASE_URL` set to the production string:

   ```bash
   pnpm db:seed
   ```

   No demo accounts are created against a non-local database.
5. **Stripe.** Set your final prices in `src/config/pricing.ts`. Then, with your live key:

   ```bash
   STRIPE_SECRET_KEY=sk_live_... pnpm stripe:setup --live --webhook https://example.com
   ```

   This creates the products, prices, and Customer Portal settings, plus the webhook endpoint. Put the printed `whsec_…` into `STRIPE_WEBHOOK_SECRET` and redeploy. Do a test-mode run first using a preview deployment's URL.
6. **Email.** Verify your sending domain in [Resend](https://resend.com) and set `RESEND_API_KEY` and `EMAIL_FROM` (e.g. `"Your Brand <hello@example.com>"`).
7. **Go live.** Sign up with your admin email and check `/admin`. Then buy a plan with a real card and refund it from Stripe, to confirm webhooks work end to end.

Rename the product in `src/config/site.ts` (`name`, `tagline`, `description`).
