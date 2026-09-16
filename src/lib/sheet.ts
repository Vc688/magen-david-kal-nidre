import { getDraw, getEntries } from "@/lib/store";
import type { Entry } from "@/types";

/**
 * Google Sheet "ticket auditor".
 *
 * The sheet is fed by a tiny Google Apps Script web app (see
 * docs/google-sheet-auditor.gs). Every push sends the *complete* current
 * state — one row per ticket, one row per entry, and a summary — and the
 * script rewrites the tabs, so the sheet can never drift from the app.
 *
 * Env: SHEET_WEBHOOK_URL (the Apps Script /exec URL), SHEET_WEBHOOK_SECRET.
 */

export type SheetPushResult = {
  ok: boolean;
  at: string;
  tickets: number;
  entries: number;
  error?: string;
};

let lastPush: SheetPushResult | undefined;
let pushQueue: Promise<unknown> = Promise.resolve();

export function isSheetConfigured(): boolean {
  return Boolean(process.env.SHEET_WEBHOOK_URL && process.env.SHEET_WEBHOOK_SECRET);
}

export function getLastSheetPush(): SheetPushResult | undefined {
  return lastPush;
}

function money(cents: number): number {
  return Math.round(cents) / 100;
}

function packageLabel(entry: Entry): string {
  return `${entry.packageTickets} for $${(entry.packagePriceCents / 100).toFixed(0)}`;
}

function nyTime(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York" });
}

async function buildSnapshot() {
  const [entries, draw] = await Promise.all([getEntries(), getDraw()]);
  const paid = entries.filter((entry) => entry.status === "paid");

  const ticketRows: (string | number)[][] = [];
  for (const entry of paid) {
    for (const ticketNumber of entry.ticketNumbers || []) {
      ticketRows.push([
        ticketNumber,
        entry.buyer.name,
        entry.buyer.email,
        entry.buyer.phone || "",
        packageLabel(entry),
        entry.id,
        nyTime(entry.paidAt),
        entry.stripePaymentIntentId || "",
        draw?.ticketNumber === ticketNumber ? "WINNER" : ""
      ]);
    }
  }
  ticketRows.sort((a, b) => Number(a[0]) - Number(b[0]));

  const entryRows = entries.map((entry) => [
    entry.id,
    entry.status,
    entry.buyer.name,
    entry.buyer.email,
    entry.buyer.phone || "",
    packageLabel(entry),
    entry.quantity,
    entry.ticketCount,
    (entry.ticketNumbers || []).join(", "),
    money(entry.subtotalCents),
    money(entry.feeCoverCents),
    money(entry.totalAmountCents),
    nyTime(entry.createdAt),
    nyTime(entry.paidAt),
    entry.stripePaymentIntentId || "",
    entry.adminNotes || ""
  ]);

  const ticketsSold = paid.reduce((sum, entry) => sum + entry.ticketCount, 0);
  const ticketsIssued = ticketRows.length;
  const summary: (string | number)[][] = [
    ["Last updated (NY)", nyTime(new Date().toISOString())],
    ["Tickets sold", ticketsSold],
    ["Ticket numbers issued", ticketsIssued],
    ["Audit check", ticketsSold === ticketsIssued ? "OK — every sold ticket has a number" : "MISMATCH — check Entries tab"],
    ["Paid entries", paid.length],
    ["Total collected ($)", money(paid.reduce((sum, entry) => sum + entry.totalAmountCents, 0))],
    ["Fees covered by buyers ($)", money(paid.reduce((sum, entry) => sum + entry.feeCoverCents, 0))],
    ["Winner", draw ? `Ticket #${draw.ticketNumber} — ${draw.winnerName} (drawn ${nyTime(draw.drawnAt)})` : "Not drawn yet"]
  ];

  return {
    tickets: {
      header: ["Ticket #", "Buyer", "Email", "Phone", "Package", "Entry ID", "Paid at (NY)", "Stripe payment", "Winner"],
      rows: ticketRows
    },
    entries: {
      header: [
        "Entry ID", "Status", "Buyer", "Email", "Phone", "Package", "Qty", "Tickets", "Ticket #s",
        "Subtotal ($)", "Fees covered ($)", "Total ($)", "Created (NY)", "Paid (NY)", "Stripe payment", "Admin notes"
      ],
      rows: entryRows
    },
    summary
  };
}

/** Pushes the current state to the sheet. Returns the result; never throws. */
export async function pushToSheet(): Promise<SheetPushResult> {
  const at = new Date().toISOString();
  if (!isSheetConfigured()) {
    return { ok: false, at, tickets: 0, entries: 0, error: "Google Sheet is not configured (SHEET_WEBHOOK_URL / SHEET_WEBHOOK_SECRET)." };
  }
  try {
    const snapshot = await buildSnapshot();
    const response = await fetch(process.env.SHEET_WEBHOOK_URL!, {
      method: "POST",
      // Apps Script only parses JSON reliably when sent as text/plain.
      headers: { "content-type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ secret: process.env.SHEET_WEBHOOK_SECRET, ...snapshot }),
      redirect: "follow",
      signal: AbortSignal.timeout(20_000)
    });
    const text = await response.text();
    let payload: { ok?: boolean; error?: string } = {};
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { ok: false, error: `Unexpected response (${response.status}): ${text.slice(0, 120)}` };
    }
    const result: SheetPushResult = {
      ok: response.ok && payload.ok === true,
      at,
      tickets: snapshot.tickets.rows.length,
      entries: snapshot.entries.rows.length,
      error: response.ok && payload.ok === true ? undefined : payload.error || `HTTP ${response.status}`
    };
    lastPush = result;
    return result;
  } catch (error) {
    const result: SheetPushResult = {
      ok: false,
      at,
      tickets: 0,
      entries: 0,
      error: error instanceof Error ? error.message : "Push failed."
    };
    lastPush = result;
    return result;
  }
}

/**
 * Fire-and-forget push used after any change. Serialised so rapid changes
 * don't race; the last push always reflects the final state.
 */
export function schedulePushToSheet(): void {
  if (!isSheetConfigured()) return;
  pushQueue = pushQueue.then(
    () => pushToSheet().then((r) => {
      if (!r.ok) console.error("Google Sheet push failed:", r.error);
    }),
    () => undefined
  );
}
