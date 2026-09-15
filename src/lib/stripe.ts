import Stripe from "stripe";

let stripeClient: Stripe | undefined;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== "sk_test_replace_me");
}

export function getStripe(): Stripe {
  if (!isStripeConfigured()) {
    throw new Error("Stripe is not configured. Add STRIPE_SECRET_KEY to .env.local.");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return stripeClient;
}

/**
 * Resolves the public site URL. Prefers the host the request actually arrived
 * on (via Railway's forwarded headers), so Stripe redirects stay correct on any
 * domain without needing BASE_URL updated when the URL changes.
 * Falls back to the BASE_URL env var, then localhost for local dev.
 */
export function baseUrl(request?: { headers: Headers }): string {
  if (request) {
    const proto = request.headers.get("x-forwarded-proto") || "https";
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    if (host) {
      return `${proto}://${host}`.replace(/\/$/, "");
    }
  }
  return (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
}
