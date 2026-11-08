import "server-only";
import { db } from "../db";
import { sendEmail } from "../email";
import { notify } from "../notifications";
import { siteConfig } from "@/config/site";
import { PAYMENT_GRACE_DAYS, TIERS } from "@/config/pricing";

async function userByCustomer(customer: string) {
  return db.user.findUnique({ where: { stripeCustomerId: customer }, select: { id: true, email: true } });
}

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);

export async function trialEndingEmail(customer: string, trialEnd: Date) {
  const u = await userByCustomer(customer);
  if (!u) return;
  const when = trialEnd.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  await sendEmail({
    to: u.email,
    subject: `Your free trial ends ${when}`,
    text: `Your ${siteConfig.name} trial ends on ${when}. Unless you cancel before then, your subscription will start and your card will be charged.\n\nYou can change plans or cancel anytime from your billing page.`,
    action: { label: "Manage billing", url: `${siteConfig.url}/account/billing` },
  });
  await notify({ userId: u.id, type: "SUBSCRIPTION", title: `Your free trial ends ${when}`, href: "/account/billing" });
}

export async function paymentFailedEmail(customer: string) {
  const u = await userByCustomer(customer);
  if (!u) return;
  await sendEmail({
    to: u.email,
    subject: "We couldn't process your payment",
    text: `Your latest payment for ${siteConfig.name} didn't go through. You'll keep full access for ${PAYMENT_GRACE_DAYS} days while we retry. Updating your card now avoids any interruption.`,
    action: { label: "Update payment method", url: `${siteConfig.url}/account/billing` },
  });
  await notify({ userId: u.id, type: "SUBSCRIPTION", title: "Payment failed. Please update your card.", href: "/account/billing" });
}

export async function receiptEmail(customer: string, amountCents: number, currency: string, invoiceUrl: string | null) {
  const u = await userByCustomer(customer);
  if (!u || amountCents <= 0) return;
  const sub = await db.subscription.findFirst({ where: { userId: u.id }, orderBy: { updatedAt: "desc" }, select: { tier: true } });
  const tier = sub?.tier;
  await sendEmail({
    to: u.email,
    subject: `Receipt: ${money(amountCents, currency)} for ${siteConfig.name}${tier ? ` ${TIERS[tier].name}` : ""}`,
    text: `Thanks! We received your payment of ${money(amountCents, currency)}.`,
    action: invoiceUrl ? { label: "View invoice", url: invoiceUrl } : undefined,
  });
}
