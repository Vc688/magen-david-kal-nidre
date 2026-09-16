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

## Google Sheet ticket auditor (optional)

The app can mirror every ticket and entry into a Google Sheet after each
change (payment, delete, status edit, draw) and on demand via the admin's
**Push to Google Sheet** button. Tabs: **Tickets** (one row per ticket
number), **Entries**, **Summary** (with an audit check that every sold ticket
has a number).

Setup (about 5 minutes, no Google Cloud project needed):

1. Create a new Google Sheet.
2. **Extensions → Apps Script**. Delete the default code and paste the contents
   of `docs/google-sheet-auditor.gs`.
3. Change `SECRET` at the top of the script to a long random string.
4. **Deploy → New deployment → Web app**. Execute as **Me**; who has access:
   **Anyone**. Authorize when prompted, then copy the Web app URL (ends in `/exec`).
5. In Railway, add `SHEET_WEBHOOK_URL` = that URL and `SHEET_WEBHOOK_SECRET` =
   the same secret. Railway redeploys automatically.
6. Railway redeploys; the sheet fills in on its own within a few seconds of the server starting.

The sheet updates automatically after every change, on every server start,
and every 10 minutes as a safety net. **Push to Google Sheet** in the admin
sends it immediately if you ever want to force it.

If you later edit the script, you must **Deploy → Manage deployments → Edit →
New version** for the change to take effect.

## Deploy (Railway)

- Push to `main`; Railway builds with pnpm.
- Variables: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ADMIN_PASSWORD` (+ optional `SHEET_WEBHOOK_URL`, `SHEET_WEBHOOK_SECRET`).
- **Mount a persistent volume at `/app/data`** so entries, the draw result, and
  admin edits survive redeploys.

Live: https://magen-david-kal-nidre-production.up.railway.app
