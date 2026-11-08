# Phase 1 proposal: architecture, schema, routes

Status: **implemented**. All six phases are built, using the recommended defaults in §7. Where the build differs from this proposal, the code, the README, and `content/AUTHORING.md` are authoritative.

- The Prisma schema is in [`prisma/schema.prisma`](../prisma/schema.prisma). It has 40 models and passes `prisma validate` on Prisma 7.10.1.
- Open decisions are collected in §7. Each one has a recommended default.

---

## 1. Stack (pinned at scaffold time)

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router), TypeScript strict, React 19 | Partial Prerendering (`cacheComponents`) for the static chapter shell plus a dynamic paywall section |
| Styling | Tailwind CSS v4, `@tailwindcss/typography` | Theme tokens live in CSS variables so light and dark mode are one switch |
| Fonts | Body: **Source Serif 4**. UI/headings: **Source Sans 3**. Mono: **JetBrains Mono** | Loaded with `next/font`, self-hosted, no layout shift. This is close to the r4ds/Quarto feel. |
| Math/chem | KaTeX via `remark-math` + `rehype-katex`, plus the **mhchem** extension for `\ce{H2SO4 <=> ...}` | Rendered on the server, so no client JS is needed for math |
| MDX | `next-mdx-remote-client/rsc` + `gray-matter` + zod-validated frontmatter | Custom remark/rehype plugins: heading numbering, TOC extraction, paywall split, callouts |
| DB | PostgreSQL on **Neon**, Prisma 7 (`prisma-client` generator, `@prisma/adapter-neon`) | Neon branches give each Vercel preview deploy its own database |
| Auth | **Better Auth** (recommended, see §7 Q1), or Auth.js v5 | Email + password, Google OAuth, database sessions, built-in rate limiting, admin plugin for roles and bans |
| Payments | Stripe Checkout, Customer Portal, webhooks | `stripe` SDK v23 |
| Email | Resend + React Email templates | |
| Uploads | Vercel Blob with client uploads through short-lived tokens (signed); private store for verification evidence | |
| Rate limiting | Upstash Redis (`@upstash/ratelimit`) for forum and API routes. Better Auth's limiter covers auth routes. | |
| Search | Postgres `tsvector` generated columns + GIN indexes, queried with `websearch_to_tsquery` | |
| Sanitization | `remark` → `rehype-sanitize` (strict schema) → KaTeX for all user Markdown | Raw HTML is never rendered |
| Testing | Vitest (unit), Playwright (E2E), Stripe CLI for webhook fixtures | |
| Package manager | pnpm | |

---

## 2. Folder structure

```
.
├── content/                         # The "book": all study content lives here, in git
│   ├── AUTHORING.md                 # format spec; `pnpm content:check` enforces it
│   ├── _meta/parts.yaml             # Part titles, codes, order, intro blurbs
│   ├── book/<part>/NN-slug.mdx      # <part> ∈ getting-started, cp, cars, bb, ps, appendix
│   ├── book/<part>/_coming-soon.yaml
│   ├── questions/<part>/<slug>.yaml # inline / quiz / bank questions + CARS passages
│   └── flashcards/<part>/<slug>.yaml
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/                  # includes hand-written SQL: tsvector cols, GIN, CHECKs
│   └── seed.ts                      # roles/badges/categories/tags + demo users + content sync
├── prisma.config.ts
│
├── public/                          # og images, favicons, chapter diagrams (SVG)
│
├── scripts/
│   ├── content-sync.ts              # MDX/YAML → Chapter, ContentSection, Question, Deck rows
│   ├── stripe-setup.ts              # creates test-mode products/prices from config/pricing.ts
│   └── import-questions-csv.ts      # CLI twin of the admin CSV importer
│
├── src/
│   ├── app/
│   │   ├── (book)/                  # r4ds-style 3-column layout
│   │   │   ├── layout.tsx           # sidebar + header + theme toggle
│   │   │   ├── page.tsx             # "/" Welcome / book index
│   │   │   └── [part]/[chapter]/page.tsx
│   │   ├── (app)/                   # same chrome, wide content column, auth required
│   │   │   ├── practice/…
│   │   │   ├── flashcards/…
│   │   │   ├── analytics/…
│   │   │   ├── account/…
│   │   │   └── notifications/…
│   │   ├── (marketing)/pricing/page.tsx
│   │   ├── (auth)/{sign-in,sign-up,forgot-password,reset-password,verify-email}/page.tsx
│   │   ├── forum/…
│   │   ├── u/[username]/page.tsx    # public profiles + tutor profiles
│   │   ├── tutor/…                  # tutor workspace (priority queue, requests)
│   │   ├── admin/…
│   │   ├── search/page.tsx
│   │   ├── api/
│   │   │   ├── auth/[...all]/route.ts
│   │   │   ├── stripe/webhook/route.ts
│   │   │   ├── uploads/route.ts     # issues signed client-upload tokens
│   │   │   └── og/route.tsx         # dynamic OpenGraph images
│   │   ├── sitemap.ts
│   │   └── robots.ts
│   │
│   ├── components/
│   │   ├── book/                    # Sidebar, Toc (scroll-spy), ChapterHeader, PrevNext,
│   │   │                            # ReadingProgress, MarkComplete, PaywallGate, DiscussLink
│   │   ├── mdx/                     # Callout, Question, Figure, Equation, Mnemonic, Connection, Quiz
│   │   ├── practice/                # QuestionCard, Timer, PassagePane, ResultsBreakdown
│   │   ├── flashcards/
│   │   ├── forum/                   # PostList, ReplyCard, RoleBadge, VoteButton, MarkdownEditor
│   │   ├── charts/
│   │   └── ui/                      # Button, Dialog, Drawer, Tabs… (Radix primitives)
│   │
│   ├── server/                      # server-only code ("server-only" import guard)
│   │   ├── db.ts
│   │   ├── auth.ts                  # auth config + getSession / requireUser / requireRole
│   │   ├── entitlements.ts          # THE single place that answers "can user X do Y?"
│   │   ├── content/                 # MDX loader, plugins, paywall splitter, TOC
│   │   ├── questions/
│   │   ├── srs/sm2.ts
│   │   ├── forum/                   # posting, voting, reputation, privileges
│   │   ├── billing/                 # stripe client, checkout, portal, webhook handlers
│   │   ├── email/                   # resend client + React Email templates
│   │   ├── search.ts
│   │   ├── ratelimit.ts
│   │   └── actions/                 # Server Actions, grouped by domain
│   │
│   ├── config/
│   │   ├── site.ts                  # brand name, URLs, social: one place to rename
│   │   ├── pricing.ts               # ← ALL prices, tiers, trial days, grace days, quotas
│   │   ├── reputation.ts            # point values + privilege thresholds
│   │   └── mcat.ts                  # section time limits / question counts
│   ├── lib/                         # isomorphic helpers (formatting, zod schemas)
│   ├── generated/prisma/            # Prisma client output (gitignored)
│   └── styles/globals.css
│
├── tests/
│   ├── unit/                        # vitest: sm2, entitlements, paywall split, reputation…
│   └── e2e/                         # playwright: signup→checkout→paid content; forum→tutor reply
│
├── docs/PROPOSAL.md
├── .env.example
└── README.md
```

**Key rule:** every access decision goes through `src/server/entitlements.ts`. It reads the `Subscription` table and the user's role, and it is called by pages, Server Actions, and route handlers alike. Nothing checks Stripe at request time.

---

## 3. How the hard parts work

### 3.1 Static content + paywall, without leaking paid text
- Each chapter page is prerendered. The static shell contains the sidebar, chapter header, the **full TOC** (headings are fine to expose and help SEO), and the **preview**.
- The preview ends at the first H2 boundary after ~20% of the word count. An author can override this with `{/* preview-end */}`.
- The remainder is a separate compiled MDX fragment rendered inside a `<Suspense>` dynamic boundary (PPR). It checks entitlements on the server and either renders the content or renders `<PaywallGate>`.
- The blurred area is **placeholder text shaped like the section**, under a CSS blur. The real paid text never reaches the browser of an unentitled user, and you can't remove the blur in devtools to read it.
- Crawlers see the preview + headings + `isAccessibleForFree: false` structured data (Google's paywalled-content markup). Free chapters are fully indexable.

### 3.2 Content ↔ DB sync
- `pnpm content:sync` runs on every build. It parses frontmatter and YAML and upserts `Chapter`, `ContentSection` (for search), `Question`, `Passage`, `ChapterQuizItem`, and built-in `FlashcardDeck`/`Flashcard`.
- `access`/`status` from frontmatter apply **only on first insert**. After that the admin toggle in the DB wins, so a deploy never silently reverts an admin decision.
- Questions have a `source`: the sync only touches `CONTENT` rows. Admin-created and CSV-imported rows (`ADMIN`) are never overwritten.

### 3.3 Inline questions & quizzes
- MDX: `<Question id="cp-acids-03" />`. The server renders the stem and choices statically. A small client island handles selection, submits through a Server Action (writes `QuestionAttempt` + upserts `UserQuestionStatus` + bumps `StudyDay`), and **only then receives the explanation**. Explanations are not in the HTML before you answer.
- End-of-chapter quiz = a `PracticeSet` with mode `CHAPTER_QUIZ`. The results page breaks the score down by `Topic`.

### 3.4 Search
- Two generated `tsvector` columns (`ContentSection.searchVector`, `ForumPost.searchVector`) with GIN indexes, added in a raw SQL migration.
- `/search` shows "Book" and "Forum" tabs. Paid sections show up in results, but the snippet is truncated for non-entitled users.

### 3.5 Billing state machine
- Webhooks handled: `checkout.session.completed`, `customer.subscription.{created,updated,deleted,trial_will_end}`, `invoice.{paid,payment_failed}`. Each event is recorded in `StripeEvent` for idempotency.
- Entitlement = the user's best subscription where status is `TRIALING` or `ACTIVE`, **or** `PAST_DUE` and `now < pastDueSince + GRACE_DAYS`.
- Trial: one per user (`User.trialUsedAt`). We email on `trial_will_end` (3 days before) and on payment failure.

### 3.6 Forum ranking & reputation
- Replies are sorted: accepted answer → replies by verified roles (TUTOR/EXPERT/MOD/ADMIN, highlighted) → score → oldest.
- Reputation is an append-only `ReputationEvent` log plus a cached `Profile.reputation`. Point values and privilege thresholds live in `config/reputation.ts`. Proposed defaults:

| Event | Points | | Privilege | Rep |
|---|---|---|---|---|
| Your question upvoted | +5 | | Upvote | 15 |
| Your answer upvoted | +10 | | Flag/report posts | 15 |
| Your answer accepted | +15 | | Add/edit tags on any post | 200 |
| You accept an answer | +2 | | Create new tags | 500 |
| | | | Edit others' posts | 1000 |

  Verified roles bypass the thresholds.

---

## 4. Route map

Legend: 🌐 public · 🔑 signed in · 💎 Premium · 🎓 Premium + Tutoring · 🧑‍🏫 Tutor/Expert · 🛡 Moderator · 👑 Admin. Gated pages render a preview or upsell rather than redirecting, wherever that makes sense.

### Book
| Route | Access | Notes |
|---|---|---|
| `/` | 🌐 | Book welcome page (r4ds "Welcome"), part overview, continue-reading card when signed in |
| `/getting-started/[chapter]` | 🌐 | Part 0, all free |
| `/cp/[chapter]`, `/cars/[chapter]`, `/bb/[chapter]`, `/ps/[chapter]` | 🌐 preview / 💎 full | Chapter 1 of each part is free |
| `/appendix/[chapter]` | 🌐 preview / 💎 full | |
| `/[part]` | 🌐 | Part landing page: intro + chapter list with progress |
| `/search?q=` | 🌐 | Book + forum results |

### Practice
| Route | Access | Notes |
|---|---|---|
| `/practice` | 🔑 | Hub: QBank, section tests, recent sets |
| `/practice/bank` | 🔑 (50 free) / 💎 | Filters: section, topic, difficulty, status |
| `/practice/new` | 🔑 / 💎 for timed | Configure a custom set (length, timer, filters) |
| `/practice/test` | 💎 | Pick a section → real MCAT timing |
| `/practice/[setId]` | owner | Take the set (resumable, server-side deadline) |
| `/practice/[setId]/review` | owner | Score, per-topic breakdown, explanations |
| `/[part]/[chapter]/quiz` | 🔑 free chapter / 💎 | End-of-chapter quiz |

### Flashcards & analytics
| Route | Access | Notes |
|---|---|---|
| `/flashcards` | 🔑 | Decks: built-in per chapter + mine; due counts |
| `/flashcards/[deckId]` | 🔑 browse / 💎 SRS | Free = flip through; Premium = scheduled review |
| `/flashcards/review` | 💎 | All due cards across decks |
| `/flashcards/new`, `/flashcards/[deckId]/edit` | 💎 | User-created decks |
| `/analytics` | 💎 (🔑 sees a sample dashboard) | Accuracy over time, time/question, weakest topics, streak, readiness |

### Forum & community
| Route | Access | Notes |
|---|---|---|
| `/forum` | 🌐 read | Categories + latest/unanswered/priority tabs |
| `/forum/c/[category]` | 🌐 | |
| `/forum/t/[tag]` | 🌐 | |
| `/forum/chapter/[slug]` | 🌐 | "Discuss this chapter": threads tagged to it + "Ask about this chapter" |
| `/forum/p/[postId]/[slug]` | 🌐 read / 💎 reply, vote | |
| `/forum/new?chapter=&anchor=` | 💎 | Markdown + LaTeX editor with preview, image upload |
| `/u/[username]` | 🌐 | Profile, badges, rep, recent answers; tutors get a "Request a session" button (🎓) |
| `/notifications` | 🔑 | |
| `/tutor` | 🧑‍🏫 | Priority queue (🎓 members' unanswered questions first) |
| `/tutor/requests`, `/tutor/requests/[id]` | 🧑‍🏫 | Accept/decline/schedule + message thread |
| `/account/tutoring`, `/account/tutoring/[id]` | 🎓 | Student side of requests (2 per billing period) |
| `/account/verify` | 🔑 | Apply for Verified Tutor / Expert |

### Account & billing
| Route | Access | Notes |
|---|---|---|
| `/pricing` | 🌐 | r4ds-styled; monthly/annual toggle |
| `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/verify-email` | 🌐 | |
| `/account` | 🔑 | Profile, target date/score, notification prefs |
| `/account/billing` | 🔑 | Current plan, link to Stripe Portal |
| `/checkout/success`, `/checkout/canceled` | 🔑 | |

### Admin
| Route | Access |
|---|---|
| `/admin` (metrics: signups, active subs by tier, MRR, most-missed questions) | 👑 |
| `/admin/content` (paid/free, publish/unpublish, early access date) | 👑 |
| `/admin/questions`, `/admin/questions/new`, `/admin/questions/[id]`, `/admin/questions/import` | 👑 |
| `/admin/users`, `/admin/users/[id]` (role, badges, subscription view, ban) | 👑 |
| `/admin/verifications` | 👑 |
| `/admin/moderation` (reports queue, hidden/locked) | 🛡 👑 |
| `/admin/settings` (promo-code toggle, feature flags) | 👑 |

### API routes (most mutations are Server Actions instead)
`/api/auth/[...all]` · `/api/stripe/webhook` · `/api/uploads` · `/api/og` · `/sitemap.xml` · `/robots.txt`

---

## 5. Seed content plan (Phase 2)

| Part | Seeded (complete) | Shown as "Coming soon" |
|---|---|---|
| 0 Getting Started | How the MCAT is scored · Building a study schedule · How to use this site · Test day & logistics | – |
| CP | **1 Atoms, electrons & periodic trends** (free) · **2 Acids & bases** | Kinematics & forces, Work & energy, Fluids, Electrostatics & circuits, Light & optics, Thermochemistry, Kinetics & equilibrium, Electrochemistry, Organic reactions, Separations & spectroscopy |
| CARS | **1 How CARS works: reading for structure** (free) · **2 Question types & answer elimination** | Humanities passages, Social-science passages, Timing strategy, Reasoning beyond the text |
| BB | **1 Amino acids & protein structure** (free) · **2 Enzymes & kinetics** | Metabolism I/II, DNA & gene expression, Cell biology, Nervous system, Endocrine, Cardio/resp, Renal & digestive, Immune, Reproduction & development, Genetics & evolution |
| PS | **1 Sensation & perception** (free) · **2 Learning & memory** | Cognition & language, Emotion & stress, Identity & personality, Social behavior, Social structure, Demographics & inequality |
| Appendix | High-yield equations · Amino acid table · Hormone table · Lab techniques | – |

Each seeded chapter gets 3–5 inline questions, a 10–15 question quiz, and a built-in flashcard deck. On top of that, the bank-only sets bring the starter QBank to roughly 200 questions, including passage-based sets.

Caveat: a true full-length section test needs 59 questions per section (53 for CARS) of mostly passage-based items. The seed will contain at least one complete section test per section. Building a deep bank beyond that is ongoing authoring work, and the admin CSV importer exists so that work can be done outside the codebase.

---

## 6. Phase plan and commits
1. ✅ This proposal: `docs: phase 1 architecture proposal and Prisma schema`
2. Scaffold, auth, DB, r4ds reading layout, seed content
3. Question bank, practice/tests, flashcards, analytics
4. Forum, roles, reputation, notifications, tutoring requests
5. Stripe, entitlements, paywall
6. Admin, tests, polish, README/deploy docs

---

## 7. Decisions needed from you

| # | Decision | My recommendation |
|---|---|---|
| Q1 | **Auth library.** Auth.js v5 is still only in beta (5.0.0-beta.32), and the Auth.js team has joined Better Auth, which is where active development now happens. | **Better Auth.** It covers the spec (email/password, Google, roles, bans, rate limiting) and uses DB sessions, so role changes and bans take effect immediately. |
| Q2 | **Brand name / domain.** | Keep `[YOUR BRAND NAME]` in `config/site.ts` until you choose. Renaming then takes one line. |
| Q3 | **Free trial.** Require a card up front? | Yes, card required, one trial per account. This is standard, cuts abuse, and Stripe converts automatically. |
| Q4 | **Free tier's 50 QBank questions.** A fixed curated set, or any first 50 a user answers? | Fixed curated set (`Question.isFree`). It's predictable, shows off the best questions, and is simple to enforce. |
| Q5 | **Failed-payment grace period.** | 7 days of continued access while Stripe retries, then access drops to Free. |
| Q6 | **Tutoring quota window.** "2 per month": per calendar month or per billing period? | Per billing period (for annual plans, 2 per monthly anniversary). Unused requests don't roll over. |
| Q7 | **Chapter numbering.** r4ds numbers chapters globally (1…N). | Number per Part ("CP 2", sections "CP 2.3"), so adding a CP chapter doesn't renumber every BB/PS chapter. |
| Q8 | **Infra accounts.** Neon, Vercel Blob, Upstash Redis, Resend, Stripe. | Fine as listed? All have free tiers. Supabase can replace Neon + Blob if you prefer one vendor. |

Things I treated as already decided by your spec, so not asking: tier prices (placeholders in `config/pricing.ts`), tier boundaries as in your table, the ~20% annual discount, the forum category list, and the role names.
