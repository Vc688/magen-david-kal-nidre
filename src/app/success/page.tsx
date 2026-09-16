import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { fillCopy, getSiteContent } from "@/lib/content";
import { formatMoney } from "@/lib/money";
import { recordPaidSession } from "@/lib/reconcile";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { schedulePushToSheet } from "@/lib/sheet";
import { getEntryByCheckoutSession } from "@/lib/store";
import type { Entry } from "@/types";

export const dynamic = "force-dynamic";

/**
 * Looks up the entry for this Checkout session. If the webhook hasn't landed
 * yet (or the record went missing), confirms directly with Stripe so the buyer
 * always sees their ticket numbers.
 */
async function resolveEntry(sessionId?: string): Promise<Entry | undefined> {
  if (!sessionId) return undefined;
  let entry = await getEntryByCheckoutSession(sessionId);
  if (entry?.status !== "paid" && isStripeConfigured()) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId);
      const id = await recordPaidSession(session);
      if (id) schedulePushToSheet();
      entry = await getEntryByCheckoutSession(sessionId);
    } catch {
      // Leave as-is; the webhook or an admin "Sync from Stripe" will reconcile.
    }
  }
  return entry;
}

export default async function SuccessPage({
  searchParams
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  const [content, entry] = await Promise.all([getSiteContent(), resolveEntry(session_id)]);
  const paid = entry?.status === "paid";

  return (
    <main className="page">
      <SiteHeader content={content} />
      <div className="content">
        <section className="system-card">
          <span className="system-icon ok">
            <CheckCircle2 size={40} />
          </span>
          <h1>{paid ? content.successTitle : "Thank you — we're confirming your payment"}</h1>
          <p>
            {paid
              ? fillCopy(content.successBody, content)
              : "Your payment is being confirmed with Stripe. You will receive an email receipt shortly; if this page still shows as unconfirmed after a few minutes, please contact the shul office."}
          </p>

          {entry ? (
            <div className="receipt">
              <h2>Your ticket numbers</h2>
              <div className="ticket-numbers">
                {(entry.ticketNumbers || []).map((n) => (
                  <span className="ticket-chip" key={n}>
                    #{n}
                  </span>
                ))}
                {!entry.ticketNumbers?.length ? <span className="muted">Assigned once payment is confirmed.</span> : null}
              </div>
              <div className="receipt-total">
                <span>
                  {entry.ticketCount} {entry.ticketCount === 1 ? "ticket" : "tickets"} · {entry.buyer.name}
                </span>
                <strong>{formatMoney(entry.totalAmountCents)}</strong>
              </div>
              <p className="muted">Reference: {entry.id}</p>
            </div>
          ) : session_id ? (
            <p className="muted">Reference: {session_id}</p>
          ) : null}

          <div className="system-actions">
            <Link href="/#tickets" className="hero-cta">
              Buy more tickets
            </Link>
            <a className="ghost-link" href={content.shulWebsiteUrl} target="_blank" rel="noopener noreferrer">
              Back to {content.shulWebsiteLabel}
            </a>
          </div>
        </section>
      </div>
      <SiteFooter content={content} />
    </main>
  );
}
