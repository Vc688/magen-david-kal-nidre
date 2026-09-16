/**
 * Runs once when the Node server boots (Next.js instrumentation hook).
 * Keeps the Google Sheet auditor in sync without anyone clicking anything:
 * one push at startup, then a safety-net push every 10 minutes in case an
 * event-driven push failed (network blip, Apps Script hiccup).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { isSheetConfigured, schedulePushToSheet } = await import("@/lib/sheet");
  if (!isSheetConfigured()) return;

  // Small delay so the server is fully up before the first push.
  setTimeout(schedulePushToSheet, 5_000);
  setInterval(schedulePushToSheet, 10 * 60 * 1000);
}
