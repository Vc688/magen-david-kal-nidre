export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(cents / 100);
}

/** "$1,000" style — for package prices that are whole dollars. */
export function formatWhole(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(cents / 100);
}

/** Stripe's standard US card pricing. */
const STRIPE_PERCENT = 0.029;
const STRIPE_FIXED_CENTS = 30;

/**
 * Gross-up so the shul nets `netCents` after Stripe's fee:
 *   total = (net + fixed) / (1 - rate)
 * Returns just the extra cents the buyer adds when they tick "cover fees".
 */
export function feeCoverCents(netCents: number): number {
  if (netCents <= 0) return 0;
  const total = Math.ceil((netCents + STRIPE_FIXED_CENTS) / (1 - STRIPE_PERCENT));
  return total - netCents;
}
