import type Stripe from "stripe";

import { getStripe } from "@/lib/stripe";
import { getEntries, insertEntry, markEntryPaid, updateEntry } from "@/lib/store";
import type { Entry } from "@/types";

export type SyncResult = {
  scanned: number;
  added: string[];
  markedPaid: string[];
  alreadyCurrent: number;
};

const CAMPAIGN = "kal-nidre-raffle";
const UNKNOWN_BUYER = "Unknown buyer";

function buyerFromSession(session: Stripe.Checkout.Session): Entry["buyer"] {
  const email = session.customer_details?.email || session.customer_email || "";
  return {
    name: session.customer_details?.name || session.metadata?.buyerName || email || UNKNOWN_BUYER,
    email,
    phone: session.customer_details?.phone || undefined
  };
}

function entryFromSession(session: Stripe.Checkout.Session, items: Stripe.LineItem[]): Entry {
  const meta = session.metadata || {};
  const quantity = parseInt(meta.quantity || "1", 10) || 1;
  const packageTickets = parseInt(meta.packageTickets || "1", 10) || 1;
  let packagePriceCents = 0;
  let subtotalCents = 0;
  let feeCoverCents = 0;
  for (const item of items) {
    const label = item.description || "";
    if (label === "Cover processing fees") {
      feeCoverCents += item.amount_total;
    } else {
      packagePriceCents = item.price?.unit_amount || packagePriceCents;
      subtotalCents += item.amount_total;
    }
  }
  const paidAt = new Date(session.created * 1000).toISOString();
  return {
    id: meta.entryId || `kn_stripe_${session.id.slice(-12)}`,
    status: "paid",
    buyer: buyerFromSession(session),
    packageId: meta.packageId || "unknown",
    packageTickets,
    packagePriceCents,
    quantity,
    ticketCount: parseInt(meta.ticketCount || "0", 10) || packageTickets * quantity,
    subtotalCents,
    coverFees: feeCoverCents > 0,
    feeCoverCents,
    totalAmountCents: session.amount_total || 0,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : undefined,
    stripeCustomerId: typeof session.customer === "string" ? session.customer : undefined,
    createdAt: paidAt,
    updatedAt: new Date().toISOString(),
    paidAt,
    adminNotes: "Recovered from Stripe by Sync."
  };
}

function stripeIds(session: Stripe.Checkout.Session) {
  return {
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : undefined,
    stripeCustomerId: typeof session.customer === "string" ? session.customer : undefined
  };
}

/**
 * Marks the local entry for a paid session as paid — or, if the record is
 * missing (e.g. `data/` was reset by a redeploy), rebuilds it from Stripe.
 * Used by the webhook and the thank-you page. Returns the entry id.
 */
export async function recordPaidSession(session: Stripe.Checkout.Session): Promise<string | undefined> {
  if (session.payment_status !== "paid") return undefined;
  const existing = await getEntries();
  const local =
    existing.find((entry) => entry.stripeCheckoutSessionId === session.id) ||
    existing.find((entry) => entry.id === session.metadata?.entryId);

  if (local) {
    if (local.status !== "paid") {
      await markEntryPaid(local.id, stripeIds(session));
    }
    return local.id;
  }

  if (session.metadata?.campaign !== CAMPAIGN) return undefined;
  const items = await getStripe().checkout.sessions.listLineItems(session.id, { limit: 10 });
  const entry = entryFromSession(session, items.data);
  await insertEntry(entry);
  return entry.id;
}

/**
 * Pulls every paid raffle Checkout session from Stripe and makes the local
 * records match: pending/missing entries become paid. Safe to run repeatedly.
 */
export async function syncFromStripe(): Promise<SyncResult> {
  const stripe = getStripe();
  const existing = await getEntries();
  const byId = new Map(existing.map((entry) => [entry.id, entry]));
  const bySession = new Map(
    existing.filter((entry) => entry.stripeCheckoutSessionId).map((entry) => [entry.stripeCheckoutSessionId!, entry])
  );

  const result: SyncResult = { scanned: 0, added: [], markedPaid: [], alreadyCurrent: 0 };

  for await (const session of stripe.checkout.sessions.list({ limit: 100 })) {
    if (session.metadata?.campaign !== CAMPAIGN || session.payment_status !== "paid") {
      continue;
    }
    result.scanned += 1;
    const local = bySession.get(session.id) || byId.get(session.metadata?.entryId || "");

    if (local?.status === "paid") {
      if (local.buyer.name === UNKNOWN_BUYER) {
        const buyer = buyerFromSession(session);
        if (buyer.name !== UNKNOWN_BUYER) {
          await updateEntry(local.id, (entry) => {
            entry.buyer = buyer;
          });
          result.markedPaid.push(local.id);
          continue;
        }
      }
      result.alreadyCurrent += 1;
      continue;
    }
    if (local) {
      await markEntryPaid(local.id, stripeIds(session));
      result.markedPaid.push(local.id);
      continue;
    }

    const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
    const entry = entryFromSession(session, items.data);
    await insertEntry(entry);
    byId.set(entry.id, entry);
    result.added.push(entry.id);
  }

  return result;
}
