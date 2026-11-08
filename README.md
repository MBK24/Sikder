# MCAT Prep Platform

An online MCAT textbook in the style of [R for Data Science](https://r4ds.hadley.nz/), with inline practice questions, a question bank, spaced-repetition flashcards, analytics, and a tutor-backed forum.

> **Status:** Phase 4 of 6. Done: the reading experience, auth, database, seed content, question bank, practice sets and section tests, quizzes, flashcards, analytics, and the forum (roles, reputation, notifications, moderation, tutoring requests). Still to come: Stripe payments and paywall, the full admin dashboard, end-to-end tests, and deploy docs. See [docs/PROPOSAL.md](docs/PROPOSAL.md) for the architecture and phase plan.

## Stack

Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS v4 · PostgreSQL + Prisma 7 · Better Auth · MDX + KaTeX/mhchem · Vitest

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

**Demo accounts** (development only, password `password1234`):

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

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm build` | Validate content → generate Prisma client → production build |
| `pnpm content:check [filter]` | Validate all MDX/YAML in /content (math, components, ids, schemas) |
| `pnpm content:sync` | Upsert /content into the DB (chapters, search index, questions, flashcards) |
| `pnpm db:seed` | Reference data + demo users + content sync |
| `pnpm test` | Unit tests (Vitest) |
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
tests/unit/       Vitest
```

Deployment instructions (Vercel + Neon + Stripe) arrive in phase 6.
