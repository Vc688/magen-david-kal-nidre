import fs from "node:fs/promises";
import path from "node:path";

import { defaultContent } from "@/data/site-content";
import type { SiteContent, TicketPackage } from "@/types";

const dataDir = path.join(process.cwd(), "data");
const contentPath = path.join(dataDir, "site-content.json");

/**
 * Reads admin-edited overrides from `data/site-content.json` and merges them
 * onto the baked-in defaults. Any missing or blank field falls back to the
 * default so the page never renders empty copy.
 */
export async function getSiteContent(): Promise<SiteContent> {
  try {
    const raw = await fs.readFile(contentPath, "utf-8");
    const saved = JSON.parse(raw) as Partial<SiteContent>;
    return mergeContent(saved);
  } catch {
    return defaultContent;
  }
}

export async function saveSiteContent(input: Partial<SiteContent>): Promise<SiteContent> {
  const merged = mergeContent(input);
  await fs.mkdir(dataDir, { recursive: true });
  const tempPath = `${contentPath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(merged, null, 2)}\n`, "utf-8");
  await fs.rename(tempPath, contentPath);
  return merged;
}

function mergePackages(input: unknown): TicketPackage[] {
  if (!Array.isArray(input)) return defaultContent.packages;
  const packages = input
    .map((raw, index) => ({
      id: clean(raw?.id) || `package-${index + 1}`,
      tickets: Math.max(1, Math.round(Number(raw?.tickets) || 0)),
      priceCents: Math.round(Number(raw?.priceCents) || 0),
      badge: clean(raw?.badge)
    }))
    .filter((pkg) => pkg.tickets > 0 && pkg.priceCents >= 100);
  return packages.length ? packages : defaultContent.packages;
}

function mergeContent(input: Partial<SiteContent>): SiteContent {
  return {
    organizationName: pick(input.organizationName, defaultContent.organizationName),
    campaignName: pick(input.campaignName, defaultContent.campaignName),
    shulWebsiteUrl: pick(input.shulWebsiteUrl, defaultContent.shulWebsiteUrl),
    shulWebsiteLabel: pick(input.shulWebsiteLabel, defaultContent.shulWebsiteLabel),
    rabbiName: pick(input.rabbiName, defaultContent.rabbiName),

    heroEyebrow: pick(input.heroEyebrow, defaultContent.heroEyebrow),
    heroTitle: pick(input.heroTitle, defaultContent.heroTitle),
    heroSubtitle: pick(input.heroSubtitle, defaultContent.heroSubtitle),
    aboutBody: pick(input.aboutBody, defaultContent.aboutBody),

    drawAtIso: pickDate(input.drawAtIso, defaultContent.drawAtIso),
    drawLabel: pick(input.drawLabel, defaultContent.drawLabel),
    packages: mergePackages(input.packages),
    allowFeeCover: pickBool(input.allowFeeCover, defaultContent.allowFeeCover),
    maxQuantity: Math.min(50, Math.max(1, Math.round(Number(input.maxQuantity) || defaultContent.maxQuantity))),
    showHowItWorks: pickBool(input.showHowItWorks, defaultContent.showHowItWorks),

    packagesTitle: pick(input.packagesTitle, defaultContent.packagesTitle),
    packagesSubtitle: pick(input.packagesSubtitle, defaultContent.packagesSubtitle),
    buyButtonLabel: pick(input.buyButtonLabel, defaultContent.buyButtonLabel),

    closedTitle: pick(input.closedTitle, defaultContent.closedTitle),
    closedBody: pick(input.closedBody, defaultContent.closedBody),
    announceWinner: pickBool(input.announceWinner, defaultContent.announceWinner),
    winnerTitle: pick(input.winnerTitle, defaultContent.winnerTitle),
    winnerBody: pick(input.winnerBody, defaultContent.winnerBody),
    successTitle: pick(input.successTitle, defaultContent.successTitle),
    successBody: pick(input.successBody, defaultContent.successBody),

    contactEmail: pick(input.contactEmail, defaultContent.contactEmail),
    footerNote: pick(input.footerNote, defaultContent.footerNote)
  };
}

/** Replaces `{rabbi}` and `{drawLabel}` placeholders in editable copy. */
export function fillCopy(text: string, content: SiteContent): string {
  return text.replace(/\{rabbi\}/g, content.rabbiName).replace(/\{drawLabel\}/g, content.drawLabel);
}

/** Splits an editable multi-paragraph field on blank lines. */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function isSalesOpen(content: SiteContent, at = new Date()): boolean {
  return at.getTime() < new Date(content.drawAtIso).getTime();
}

export function getPackage(content: SiteContent, id: string): TicketPackage | undefined {
  return content.packages.find((pkg) => pkg.id === id);
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function pick(value: unknown, fallback: string): string {
  const cleaned = clean(value);
  return cleaned || fallback;
}

function pickDate(value: unknown, fallback: string): string {
  const cleaned = clean(value);
  if (!cleaned || Number.isNaN(new Date(cleaned).getTime())) {
    return fallback;
  }
  return cleaned;
}

function pickBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}
