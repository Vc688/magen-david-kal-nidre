import type { SiteContent } from "@/types";

/**
 * Default site copy and settings. Every field can be overridden from the
 * admin dashboard ("Site content & settings" tab), which writes to
 * `data/site-content.json`. If that file is missing or a field is blank,
 * these defaults are used, so the page always renders complete copy.
 */
export const defaultContent: SiteContent = {
  organizationName: "Congregation Magen David of West Deal",
  campaignName: "Kal Nidre Raffle 2026",
  shulWebsiteUrl: "https://westdealshul.org/",
  shulWebsiteLabel: "westdealshul.org",
  rabbiName: "Rabbi Kassin",

  heroEyebrow: "West Deal Shul · Yom Kippur 5787",
  heroTitle: "The Kal Nidre Raffle",
  heroSubtitle:
    "Hold the Sefer Torah during Kal Nidre — and share in a Mi Sheberach for the whole community.",
  aboutBody: [
    "We are having the Kal Nidre raffle again this year for the West Deal Shul.",
    "To give everyone a chance to be part of this zechut, {rabbi} will make a Mi Sheberach for all of us, and the winner will hold the Sefer Torah during Kal Nidre."
  ].join("\n\n"),

  // Motzei Shabbat before Yom Kippur 5787 — Saturday, September 19, 2026, 11:15 PM Eastern
  drawAtIso: "2026-09-19T23:15:00-04:00",
  drawLabel: "Saturday night, September 19th at 11:15 PM",
  packages: [
    { id: "one", tickets: 1, priceCents: 36000, badge: "" },
    { id: "two", tickets: 2, priceCents: 61300, badge: "" },
    { id: "three", tickets: 3, priceCents: 100000, badge: "Most popular" },
    { id: "six", tickets: 6, priceCents: 180000, badge: "Best value" }
  ],
  allowFeeCover: true,
  maxQuantity: 10,
  showHowItWorks: true,

  packagesTitle: "Choose your tickets",
  packagesSubtitle: "Every ticket is a chance to hold the Sefer Torah during Kal Nidre. Pick a package below.",
  buyButtonLabel: "Buy tickets",

  closedTitle: "Ticket sales are closed",
  closedBody:
    "Thank you to everyone who took part in this year's Kal Nidre raffle. The drawing has taken place — Gemar Hatima Tova!",
  announceWinner: false,
  winnerTitle: "Mazal tov to our winner",
  winnerBody: "Thank you to everyone who took part. Gemar Hatima Tova!",
  successTitle: "You’re in the raffle!",
  successBody:
    "Your tickets are confirmed and your ticket numbers are below. {rabbi} will include you in the Mi Sheberach, and the winner will be drawn {drawLabel}. A receipt has been emailed to you. Tizku leshanim rabot!",

  contactEmail: "info@magendavid.net",
  footerNote:
    "Congregation Magen David of West Deal · 395 Deal Road, Ocean, NJ 07712 · (732) 531-3220"
};
