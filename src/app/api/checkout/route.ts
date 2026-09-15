import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { getSiteContent, isSalesOpen } from "@/lib/content";
import { baseUrl, getStripe, isStripeConfigured } from "@/lib/stripe";
import { attachCheckoutSession, createEntry, updateEntryStatus } from "@/lib/store";
import type { BuyerInfo, CheckoutInput, Entry } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validateBuyer(buyer?: BuyerInfo): string | undefined {
  if (!buyer?.name?.trim()) return "Please enter your name.";
  if (!buyer?.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer.email.trim())) {
    return "Please enter a valid email address.";
  }
  return undefined;
}

function clip(text: string, max = 500): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export async function POST(request: NextRequest) {
  const content = await getSiteContent();
  if (!isSalesOpen(content)) {
    return NextResponse.json({ error: content.closedTitle }, { status: 410 });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Online payment is not configured yet. Please contact the shul office." },
      { status: 503 }
    );
  }

  let body: CheckoutInput;
  try {
    body = (await request.json()) as CheckoutInput;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const buyerError = validateBuyer(body.buyer);
  if (buyerError) {
    return NextResponse.json({ error: buyerError }, { status: 400 });
  }

  // Validation errors are user-facing; anything thrown here is safe to show.
  let entry: Entry;
  try {
    entry = await createEntry(
      {
        buyer: {
          name: body.buyer.name.trim(),
          email: body.buyer.email.trim().toLowerCase(),
          phone: body.buyer.phone?.trim() || undefined
        },
        packageId: body.packageId,
        quantity: body.quantity,
        coverFees: body.coverFees
      },
      content
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Please check the form and try again." },
      { status: 400 }
    );
  }

  try {
    const siteUrl = baseUrl(request);
    const stripe = getStripe();
    const ticketWord = entry.packageTickets === 1 ? "ticket" : "tickets";

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        quantity: entry.quantity,
        price_data: {
          currency: "usd",
          unit_amount: entry.packagePriceCents,
          product_data: {
            name: `${content.campaignName} — ${entry.packageTickets} ${ticketWord}`,
            description: `${entry.ticketCount} raffle ${entry.ticketCount === 1 ? "ticket" : "tickets"} total`
          }
        }
      }
    ];
    if (entry.feeCoverCents > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: entry.feeCoverCents,
          product_data: { name: "Cover processing fees" }
        }
      });
    }

    const metadata = {
      entryId: entry.id,
      campaign: "kal-nidre-raffle",
      buyerName: clip(entry.buyer.name, 200),
      packageId: entry.packageId,
      packageTickets: String(entry.packageTickets),
      quantity: String(entry.quantity),
      ticketCount: String(entry.ticketCount)
    };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: entry.id,
      customer_email: entry.buyer.email,
      success_url: `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/cancel?entry_id=${entry.id}`,
      metadata,
      expires_at: entry.expiresAt ? Math.floor(new Date(entry.expiresAt).getTime() / 1000) : undefined,
      payment_intent_data: {
        // Stripe emails a receipt to this address in live mode regardless of dashboard email settings.
        receipt_email: entry.buyer.email,
        description: `${content.campaignName} — ${entry.ticketCount} ${entry.ticketCount === 1 ? "ticket" : "tickets"} — ${entry.buyer.name}`,
        metadata
      },
      line_items: lineItems
    });

    await attachCheckoutSession(entry.id, session.id);
    return NextResponse.json({ url: session.url, entryId: entry.id });
  } catch (error) {
    // Stripe/network failures: keep the detail in the server log, not the buyer's screen.
    console.error("Stripe Checkout session failed", entry.id, error);
    await updateEntryStatus(entry.id, "canceled").catch(() => undefined);
    return NextResponse.json(
      { error: "Payment could not be started right now. Please try again in a moment or contact the shul office." },
      { status: 502 }
    );
  }
}
