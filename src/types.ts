export type TicketPackage = {
  id: string;
  tickets: number;
  priceCents: number;
  /** Optional small badge, e.g. "Best value" */
  badge: string;
};

export type BuyerInfo = {
  name: string;
  email: string;
  phone?: string;
};

export type EntryStatus = "pending" | "paid" | "expired" | "canceled" | "refunded";

export type Entry = {
  id: string;
  status: EntryStatus;
  buyer: BuyerInfo;
  packageId: string;
  packageTickets: number;
  packagePriceCents: number;
  /** How many of that package were bought. */
  quantity: number;
  ticketCount: number;
  subtotalCents: number;
  coverFees: boolean;
  feeCoverCents: number;
  totalAmountCents: number;
  /** Assigned sequentially when the entry is paid. */
  ticketNumbers?: number[];
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;
  stripeCustomerId?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  paidAt?: string;
  adminNotes?: string;
};

export type DrawResult = {
  ticketNumber: number;
  entryId: string;
  winnerName: string;
  drawnAt: string;
};

export type EntriesFile = {
  entries: Entry[];
  draw?: DrawResult;
  /** Highest ticket number ever issued, so deleted entries never free up numbers. */
  lastTicketNumber?: number;
  /** Checkout sessions whose entries an admin deleted; never re-imported. */
  ignoredSessionIds?: string[];
};

export type StripeEventsFile = {
  processedEventIds: string[];
};

export type CheckoutInput = {
  buyer: BuyerInfo;
  packageId: string;
  quantity: number;
  coverFees?: boolean;
};

export type SiteContent = {
  organizationName: string;
  campaignName: string;
  shulWebsiteUrl: string;
  shulWebsiteLabel: string;
  rabbiName: string;

  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  /** Main explanatory paragraph(s); blank line separates paragraphs. */
  aboutBody: string;

  /** ISO 8601 with offset — the raffle drawing (and end of ticket sales). */
  drawAtIso: string;
  /** Human-readable, e.g. "Saturday night, September 19th at 11:15 PM" */
  drawLabel: string;
  packages: TicketPackage[];
  allowFeeCover: boolean;
  maxQuantity: number;
  showHowItWorks: boolean;

  packagesTitle: string;
  packagesSubtitle: string;
  buyButtonLabel: string;

  closedTitle: string;
  closedBody: string;
  announceWinner: boolean;
  winnerTitle: string;
  winnerBody: string;
  successTitle: string;
  successBody: string;

  contactEmail: string;
  footerNote: string;
};
