import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { getPackage } from "@/lib/content";
import { feeCoverCents } from "@/lib/money";
import type {
  CheckoutInput,
  DrawResult,
  EntriesFile,
  Entry,
  EntryStatus,
  SiteContent,
  StripeEventsFile
} from "@/types";

/** Stripe requires Checkout `expires_at` to be at least 30 minutes out. */
const CHECKOUT_MINUTES = 31;

const dataDir = path.join(process.cwd(), "data");
const entriesPath = path.join(dataDir, "entries.json");
const eventsPath = path.join(dataDir, "stripe-events.json");

let writeQueue: Promise<unknown> = Promise.resolve();

async function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(fn, fn);
  writeQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function ensureDataFiles() {
  await fs.mkdir(dataDir, { recursive: true });
  await ensureJson<EntriesFile>(entriesPath, { entries: [] });
  await ensureJson<StripeEventsFile>(eventsPath, { processedEventIds: [] });
}

async function ensureJson<T>(filePath: string, fallback: T) {
  try {
    await fs.access(filePath);
  } catch {
    await writeJson(filePath, fallback);
  }
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(filePath: string, data: T): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
  await fs.rename(tempPath, filePath);
}

function nowIso() {
  return new Date().toISOString();
}

function checkoutExpiry() {
  return new Date(Date.now() + CHECKOUT_MINUTES * 60 * 1000).toISOString();
}

function isPendingExpired(entry: Entry, at = new Date()): boolean {
  return entry.status === "pending" && Boolean(entry.expiresAt) && new Date(entry.expiresAt!) <= at;
}

function cleanExpired(entries: Entry[]): boolean {
  const at = new Date();
  let changed = false;
  for (const entry of entries) {
    if (isPendingExpired(entry, at)) {
      entry.status = "expired";
      entry.updatedAt = nowIso();
      changed = true;
    }
  }
  return changed;
}

/** Next unused ticket number across every paid entry (tickets are never reused). */
function nextTicketNumber(entries: Entry[]): number {
  let max = 0;
  for (const entry of entries) {
    for (const n of entry.ticketNumbers || []) {
      if (n > max) max = n;
    }
  }
  return max + 1;
}

function assignTickets(entry: Entry, entries: Entry[]) {
  if (entry.ticketNumbers && entry.ticketNumbers.length === entry.ticketCount) return;
  const start = nextTicketNumber(entries);
  entry.ticketNumbers = Array.from({ length: entry.ticketCount }, (_, i) => start + i);
}

async function readEntriesFile(): Promise<EntriesFile> {
  await ensureDataFiles();
  return readJson<EntriesFile>(entriesPath, { entries: [] });
}

export async function getEntries(): Promise<Entry[]> {
  const file = await readEntriesFile();
  if (cleanExpired(file.entries)) {
    await writeJson(entriesPath, file);
  }
  return file.entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getDraw(): Promise<DrawResult | undefined> {
  const file = await readEntriesFile();
  return file.draw;
}

export async function getEntryByCheckoutSession(checkoutSessionId: string): Promise<Entry | undefined> {
  const entries = await getEntries();
  return entries.find((entry) => entry.stripeCheckoutSessionId === checkoutSessionId);
}

/**
 * Creates a pending entry with all amounts computed server-side from the
 * current package list — the client's total is never trusted.
 */
export async function createEntry(input: CheckoutInput, content: SiteContent): Promise<Entry> {
  return withWriteLock(async () => {
    const file = await readEntriesFile();
    cleanExpired(file.entries);

    const pkg = getPackage(content, input.packageId);
    if (!pkg) {
      throw new Error("Please choose a ticket package.");
    }
    const quantity = Math.round(Number(input.quantity) || 0);
    if (quantity < 1 || quantity > content.maxQuantity) {
      throw new Error(`Quantity must be between 1 and ${content.maxQuantity}.`);
    }

    const subtotalCents = pkg.priceCents * quantity;
    const coverFees = content.allowFeeCover && Boolean(input.coverFees);
    const feeCents = coverFees ? feeCoverCents(subtotalCents) : 0;
    const createdAt = nowIso();
    const entry: Entry = {
      id: `kn_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      status: "pending",
      buyer: input.buyer,
      packageId: pkg.id,
      packageTickets: pkg.tickets,
      packagePriceCents: pkg.priceCents,
      quantity,
      ticketCount: pkg.tickets * quantity,
      subtotalCents,
      coverFees,
      feeCoverCents: feeCents,
      totalAmountCents: subtotalCents + feeCents,
      createdAt,
      updatedAt: createdAt,
      expiresAt: checkoutExpiry()
    };
    file.entries.unshift(entry);
    await writeJson(entriesPath, file);
    return entry;
  });
}

/** Inserts a fully-formed record (used when recovering a paid session from Stripe). */
export async function insertEntry(entry: Entry): Promise<void> {
  await withWriteLock(async () => {
    const file = await readEntriesFile();
    if (file.entries.some((candidate) => candidate.id === entry.id)) {
      return;
    }
    if (entry.status === "paid") {
      assignTickets(entry, file.entries);
    }
    file.entries.unshift(entry);
    await writeJson(entriesPath, file);
  });
}

export async function attachCheckoutSession(id: string, checkoutSessionId: string): Promise<void> {
  await updateEntry(id, (entry) => {
    entry.stripeCheckoutSessionId = checkoutSessionId;
  });
}

export async function markEntryPaid(
  id: string,
  fields: {
    stripeCheckoutSessionId?: string;
    stripePaymentIntentId?: string;
    stripeCustomerId?: string;
  }
): Promise<void> {
  await updateEntry(id, (entry, entries) => {
    entry.status = "paid";
    entry.expiresAt = undefined;
    entry.paidAt = entry.paidAt || nowIso();
    entry.stripeCheckoutSessionId = fields.stripeCheckoutSessionId || entry.stripeCheckoutSessionId;
    entry.stripePaymentIntentId = fields.stripePaymentIntentId || entry.stripePaymentIntentId;
    entry.stripeCustomerId = fields.stripeCustomerId || entry.stripeCustomerId;
    assignTickets(entry, entries);
  });
}

export async function markCheckoutExpired(checkoutSessionId: string): Promise<void> {
  await withWriteLock(async () => {
    const file = await readEntriesFile();
    const entry = file.entries.find((candidate) => candidate.stripeCheckoutSessionId === checkoutSessionId);
    if (entry && entry.status === "pending") {
      entry.status = "expired";
      entry.updatedAt = nowIso();
      entry.expiresAt = undefined;
      await writeJson(entriesPath, file);
    }
  });
}

export async function updateEntryStatus(
  id: string,
  status: EntryStatus,
  fields: { adminNotes?: string } = {}
): Promise<Entry> {
  return updateEntry(id, (entry, entries) => {
    entry.status = status;
    if (fields.adminNotes !== undefined) {
      entry.adminNotes = fields.adminNotes;
    }
    if (status !== "pending") {
      entry.expiresAt = undefined;
    }
    if (status === "paid") {
      entry.paidAt = entry.paidAt || nowIso();
      assignTickets(entry, entries);
    }
  });
}

export async function updateEntry(
  id: string,
  mutate: (entry: Entry, entries: Entry[]) => void
): Promise<Entry> {
  return withWriteLock(async () => {
    const file = await readEntriesFile();
    const entry = file.entries.find((candidate) => candidate.id === id);
    if (!entry) {
      throw new Error("Entry not found.");
    }
    mutate(entry, file.entries);
    entry.updatedAt = nowIso();
    await writeJson(entriesPath, file);
    return entry;
  });
}

/**
 * Picks one ticket uniformly at random from every paid ticket, so a buyer's
 * odds are exactly proportional to how many tickets they hold.
 */
export async function drawWinner(): Promise<DrawResult> {
  return withWriteLock(async () => {
    const file = await readEntriesFile();
    const pool: { ticketNumber: number; entry: Entry }[] = [];
    for (const entry of file.entries) {
      if (entry.status !== "paid") continue;
      for (const ticketNumber of entry.ticketNumbers || []) {
        pool.push({ ticketNumber, entry });
      }
    }
    if (pool.length === 0) {
      throw new Error("There are no paid tickets to draw from yet.");
    }
    const pick = pool[crypto.randomInt(pool.length)];
    file.draw = {
      ticketNumber: pick.ticketNumber,
      entryId: pick.entry.id,
      winnerName: pick.entry.buyer.name,
      drawnAt: nowIso()
    };
    await writeJson(entriesPath, file);
    return file.draw;
  });
}

export async function clearDraw(): Promise<void> {
  await withWriteLock(async () => {
    const file = await readEntriesFile();
    delete file.draw;
    await writeJson(entriesPath, file);
  });
}

export async function hasProcessedStripeEvent(eventId: string): Promise<boolean> {
  await ensureDataFiles();
  const file = await readJson<StripeEventsFile>(eventsPath, { processedEventIds: [] });
  return file.processedEventIds.includes(eventId);
}

export async function markStripeEventProcessed(eventId: string): Promise<void> {
  await withWriteLock(async () => {
    await ensureDataFiles();
    const file = await readJson<StripeEventsFile>(eventsPath, { processedEventIds: [] });
    if (!file.processedEventIds.includes(eventId)) {
      file.processedEventIds.push(eventId);
      await writeJson(eventsPath, file);
    }
  });
}
