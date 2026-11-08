import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/server/db";
import { getStripe } from "@/server/billing/stripe";
import { syncSubscription } from "@/server/billing/sync";
import { paymentFailedEmail, receiptEmail, trialEndingEmail } from "@/server/billing/emails";

/**
 * Stripe webhook. Keeps the Subscription table in sync; access checks read only that table.
 * Every event id is recorded first, so retries and duplicates are applied exactly once.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  if (!secret || !signature) return NextResponse.json({ error: "Not configured" }, { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency: claim the event id. A duplicate delivery hits the primary key and is skipped.
  try {
    await db.stripeEvent.create({ data: { id: event.id, type: event.type } });
  } catch {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await handle(event);
  } catch (err) {
    // Release the claim so Stripe's retry can process it.
    await db.stripeEvent.delete({ where: { id: event.id } }).catch(() => {});
    console.error(`[stripe] failed to handle ${event.type} ${event.id}`, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}

async function handle(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.client_reference_id && session.customer) {
        const customer = typeof session.customer === "string" ? session.customer : session.customer.id;
        await db.user.updateMany({ where: { id: session.client_reference_id, stripeCustomerId: null }, data: { stripeCustomerId: customer } });
      }
      if (session.subscription) {
        const id = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        await syncSubscription(await getStripe().subscriptions.retrieve(id));
      }
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      await syncSubscription(event.data.object);
      return;
    case "customer.subscription.trial_will_end": {
      const sub = event.data.object;
      const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      if (sub.trial_end) await trialEndingEmail(customer, new Date(sub.trial_end * 1000));
      return;
    }
    case "invoice.payment_failed": {
      const inv = event.data.object;
      if (inv.customer) await paymentFailedEmail(typeof inv.customer === "string" ? inv.customer : inv.customer.id);
      return;
    }
    case "invoice.paid": {
      const inv = event.data.object;
      if (!inv.customer) return;
      await receiptEmail(typeof inv.customer === "string" ? inv.customer : inv.customer.id, inv.amount_paid, inv.currency, inv.hosted_invoice_url ?? null);
      return;
    }
    default:
      return;
  }
}
