# Kal Nidre Raffle — Congregation Magen David of West Deal

Ticket sales site for the West Deal Shul Kal Nidre raffle. Buyers choose a
ticket package, pay through Stripe Checkout, and receive numbered tickets.
The admin draws a winner at random from every paid ticket.

Same stack and wiring as the bag-sale and Kapparot sites (Next.js App Router,
Stripe Checkout, password-protected admin, file-based JSON storage in `data/`),
kept as a separate app with its own design.

## What's included

- Public page: countdown to the drawing, ticket packages (1/$360, 2/$613,
  3/$1,000, 6/$1,800 by default), quantity, buyer details, optional
  "cover card processing fees" (Stripe 2.9% + 30¢ gross-up), Stripe Checkout.
- Sales close automatically at the drawing time (server-enforced).
- Ticket numbers are assigned sequentially when payment completes and shown on
  the thank-you page.
- Webhook marks entries paid; the thank-you page confirms directly with Stripe;
  an admin "Sync from Stripe" rebuilds any missing records from Stripe metadata.
- Admin (`/admin`): tickets sold, entries, search, status/notes, **Draw the
  winner** (uniform random over paid tickets), announce-winner toggle, CSV export.
- "Site content & settings": drawing date/time, packages, toggles, all copy —
  saved to `data/site-content.json`, live immediately.

## Setup

```powershell
corepack pnpm install
Copy-Item .env.example .env.local
corepack pnpm dev
```

`.env.local`: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ADMIN_PASSWORD`.

## Stripe

Webhook endpoint `/api/webhooks/stripe` — events `checkout.session.completed`
and `checkout.session.expired`. Create it in the same mode (test/live) as the key.

## Deploy (Railway)

- Push to `main`; Railway builds with pnpm.
- Variables: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ADMIN_PASSWORD`.
- **Mount a persistent volume at `/app/data`** so entries, the draw result, and
  admin edits survive redeploys.
