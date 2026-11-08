/**
 * Seeds reference data + demo accounts, then syncs /content.
 *   pnpm db:seed
 * Idempotent. Demo accounts are created only outside production (or with SEED_DEMO_USERS=1).
 */
import "dotenv/config";
import { execSync } from "node:child_process";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient, type Role, type Part } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const CATEGORIES: { slug: string; name: string; description: string; part: Part | null }[] = [
  { slug: "chem-phys", name: "Chem/Phys", description: "General chemistry, organic chemistry, physics, and biochemistry for C/P.", part: "CP" },
  { slug: "cars", name: "CARS", description: "Passages, question types, timing, and strategy for CARS.", part: "CARS" },
  { slug: "bio-biochem", name: "Bio/Biochem", description: "Biology and biochemistry for B/B.", part: "BB" },
  { slug: "psych-soc", name: "Psych/Soc", description: "Psychology and sociology for P/S.", part: "PS" },
  { slug: "study-strategy", name: "Study Strategy", description: "Schedules, resources, practice tests, and staying sane.", part: null },
  { slug: "test-day", name: "Test Day", description: "Logistics, nerves, pacing, and what to expect.", part: null },
  { slug: "applications", name: "Applications & Pre-med", description: "Score reporting, school lists, and the application cycle.", part: null },
];

const BADGES = [
  { slug: "verified-tutor", label: "Verified Tutor", description: "Vetted by our team (e.g. 515+ scorer or professional tutor).", color: "teal" },
  { slug: "expert", label: "Expert", description: "MD, PhD, faculty, or official content author.", color: "purple" },
  { slug: "515-plus", label: "515+", description: "Verified score of 515 or higher.", color: "amber" },
  { slug: "content-author", label: "Content Author", description: "Wrote chapters for this book.", color: "blue" },
  { slug: "moderator", label: "Moderator", description: "Community moderator.", color: "gray" },
];

const TAGS = ["acids-bases", "amino-acids", "enzymes", "kinetics", "periodic-trends", "nuclear-decay", "sensation", "perception", "memory", "conditioning", "passage-mapping", "timing", "full-length", "score-release"];

const DEMO_USERS: { email: string; name: string; username: string; role: Role; badges: string[] }[] = [
  { email: "admin@example.com", name: "Site Admin", username: "admin", role: "ADMIN", badges: [] },
  { email: "tutor@example.com", name: "Dana Tutor", username: "danatutor", role: "TUTOR", badges: ["verified-tutor", "515-plus"] },
  { email: "expert@example.com", name: "Dr. Sam Expert", username: "drsam", role: "EXPERT", badges: ["expert", "content-author"] },
  { email: "student@example.com", name: "Riley Student", username: "riley", role: "STUDENT", badges: [] },
  { email: "free@example.com", name: "Frankie Free", username: "frankie", role: "STUDENT", badges: [] },
];
const DEMO_PASSWORD = "password1234";

async function main() {
  for (const [i, c] of CATEGORIES.entries()) {
    await db.forumCategory.upsert({ where: { slug: c.slug }, create: { ...c, order: i + 1 }, update: { ...c, order: i + 1 } });
  }
  for (const b of BADGES) await db.badge.upsert({ where: { slug: b.slug }, create: b, update: b });
  for (const t of TAGS) await db.tag.upsert({ where: { slug: t }, create: { slug: t, name: t.replace(/-/g, " ") }, update: {} });
  await db.appSetting.upsert({
    where: { key: "checkout.allowPromotionCodes" },
    create: { key: "checkout.allowPromotionCodes", value: true },
    update: {},
  });

  if (process.env.NODE_ENV !== "production" || process.env.SEED_DEMO_USERS === "1") {
    const hash = await hashPassword(DEMO_PASSWORD);
    for (const u of DEMO_USERS) {
      const user = await db.user.upsert({
        where: { email: u.email },
        create: { email: u.email, name: u.name, role: u.role, emailVerified: true },
        update: { role: u.role },
      });
      await db.account.upsert({
        where: { providerId_accountId: { providerId: "credential", accountId: user.id } },
        create: { userId: user.id, providerId: "credential", accountId: user.id, password: hash },
        update: {},
      });
      await db.profile.upsert({
        where: { userId: user.id },
        create: { userId: user.id, username: u.username, displayName: u.name, acceptingRequests: u.role === "TUTOR" },
        update: {},
      });
      for (const slug of u.badges) {
        const badge = await db.badge.findUniqueOrThrow({ where: { slug } });
        await db.userBadge.upsert({
          where: { userId_badgeId: { userId: user.id, badgeId: badge.id } },
          create: { userId: user.id, badgeId: badge.id },
          update: {},
        });
      }
    }
    // Demo Premium subscription for the student so paid features can be tried locally.
    const student = await db.user.findUniqueOrThrow({ where: { email: "student@example.com" } });
    const now = new Date();
    await db.subscription.upsert({
      where: { id: "sub_demo_student" },
      create: {
        id: "sub_demo_student",
        userId: student.id,
        tier: "PREMIUM",
        interval: "MONTH",
        status: "ACTIVE",
        stripePriceId: "price_demo",
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 86_400_000),
      },
      update: { currentPeriodEnd: new Date(now.getTime() + 30 * 86_400_000), status: "ACTIVE" },
    });
    console.log(`seed: demo users ready (${DEMO_USERS.map((u) => u.email).join(", ")}), password "${DEMO_PASSWORD}"`);
  }

  // Promote ADMIN_EMAILS that already have accounts.
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (admins.length) await db.user.updateMany({ where: { email: { in: admins } }, data: { role: "ADMIN" } });

  console.log(`seed: ${CATEGORIES.length} forum categories, ${BADGES.length} badges, ${TAGS.length} tags`);
}

main()
  .then(() => db.$disconnect())
  .then(() => execSync("pnpm -s content:sync", { stdio: "inherit" }))
  .catch(async (err) => {
    console.error(err);
    await db.$disconnect();
    process.exit(1);
  });
