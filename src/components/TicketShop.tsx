"use client";

import { Award, Check, Lock, Minus, Plus, Ticket } from "lucide-react";
import { FormEvent, useCallback, useMemo, useState } from "react";

import Countdown from "@/components/Countdown";
import { feeCoverCents, formatMoney, formatWhole } from "@/lib/money";
import type { TicketPackage } from "@/types";

type Props = {
  initiallyOpen: boolean;
  drawAtIso: string;
  drawLabel: string;
  packages: TicketPackage[];
  allowFeeCover: boolean;
  maxQuantity: number;
  organizationName: string;
  packagesTitle: string;
  packagesSubtitle: string;
  buyButtonLabel: string;
  closedTitle: string;
  closedBody: string;
  contactEmail: string;
  winner?: { title: string; name: string; ticketNumber: number; body: string };
};

export default function TicketShop(props: Props) {
  const [open, setOpen] = useState(props.initiallyOpen);
  const defaultPkg = props.packages.find((pkg) => pkg.badge) || props.packages[0];
  const [packageId, setPackageId] = useState(defaultPkg?.id || "");
  const [quantity, setQuantity] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [coverFees, setCoverFees] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleExpire = useCallback(() => setOpen(false), []);
  const selected = props.packages.find((pkg) => pkg.id === packageId);

  const totals = useMemo(() => {
    const subtotal = (selected?.priceCents || 0) * quantity;
    const fee = props.allowFeeCover ? feeCoverCents(subtotal) : 0;
    return { subtotal, fee, total: subtotal + (coverFees ? fee : 0), tickets: (selected?.tickets || 0) * quantity };
  }, [selected, quantity, coverFees, props.allowFeeCover]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!selected) return setError("Please choose a ticket package.");
    if (!name.trim()) return setError("Please enter your name.");
    if (!email.trim() || !email.includes("@")) return setError("Please enter a valid email address.");

    setSubmitting(true);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ buyer: { name, email, phone }, packageId, quantity, coverFees })
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        if (response.status === 410) setOpen(false);
        throw new Error(data.error || "Checkout could not be started.");
      }
      window.location.assign(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="hero-timer">
        <p className="timer-label">{open ? "Drawing in" : "The drawing has taken place"}</p>
        {open ? <Countdown deadlineIso={props.drawAtIso} onExpire={handleExpire} /> : null}
        <p className="timer-when">{props.drawLabel}</p>
      </div>

      {!open ? (
        <section className="section" id="tickets">
          {props.winner ? (
            <div className="winner-banner">
              <Award size={28} />
              <div>
                <h2>{props.winner.title}</h2>
                <p>
                  <strong>{props.winner.name}</strong> — ticket #{props.winner.ticketNumber}
                </p>
                <p>{props.winner.body}</p>
              </div>
            </div>
          ) : null}
          <div className="closed-card">
            <Ticket size={30} />
            <h2>{props.closedTitle}</h2>
            <p>{props.closedBody}</p>
            <p className="muted">
              Questions? <a href={`mailto:${props.contactEmail}`}>{props.contactEmail}</a>
            </p>
          </div>
        </section>
      ) : (
        <section className="section" id="tickets">
          <div className="section-head">
            <h2>{props.packagesTitle}</h2>
            <p>{props.packagesSubtitle}</p>
          </div>

          <form className="shop" onSubmit={submit} noValidate>
            <div className="packages" role="radiogroup" aria-label="Ticket packages">
              {props.packages.map((pkg) => {
                const active = pkg.id === packageId;
                return (
                  <button
                    type="button"
                    key={pkg.id}
                    role="radio"
                    aria-checked={active}
                    className={`package${active ? " selected" : ""}`}
                    onClick={() => setPackageId(pkg.id)}
                  >
                    {pkg.badge ? <span className="package-badge">{pkg.badge}</span> : null}
                    <span className="package-tickets">
                      <strong>{pkg.tickets}</strong>
                      <span>{pkg.tickets === 1 ? "ticket" : "tickets"}</span>
                    </span>
                    <span className="package-price">{formatWhole(pkg.priceCents)}</span>
                    <span className="package-each">
                      {pkg.tickets > 1 ? `${formatWhole(Math.round(pkg.priceCents / pkg.tickets))} per ticket` : "single entry"}
                    </span>
                    <span className="package-check" aria-hidden="true">
                      <Check size={16} />
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="checkout-card">
              <div className="checkout-row">
                <div>
                  <p className="checkout-label">Your selection</p>
                  <p className="checkout-value">
                    {selected ? `${selected.tickets} ${selected.tickets === 1 ? "ticket" : "tickets"} for ${formatWhole(selected.priceCents)}` : "—"}
                  </p>
                </div>
                <div className="qty">
                  <span className="checkout-label">Packages</span>
                  <div className="qty-stepper">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      aria-label="Fewer packages"
                    >
                      <Minus size={16} />
                    </button>
                    <strong>{quantity}</strong>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.min(props.maxQuantity, q + 1))}
                      disabled={quantity >= props.maxQuantity}
                      aria-label="More packages"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="buyer-grid">
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Full name *"
                  autoComplete="name"
                  required
                />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Email address *"
                  autoComplete="email"
                  required
                />
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="Phone (optional)"
                  autoComplete="tel"
                />
              </div>

              <div className="totals">
                <div className="total-line">
                  <span>
                    {totals.tickets} {totals.tickets === 1 ? "ticket" : "tickets"}
                  </span>
                  <span>{formatMoney(totals.subtotal)}</span>
                </div>
                {props.allowFeeCover ? (
                  <label className="total-line fee-line">
                    <span>
                      <input
                        type="checkbox"
                        checked={coverFees}
                        onChange={(event) => setCoverFees(event.target.checked)}
                      />
                      Cover card processing fees
                      <small>So {props.organizationName} receives the full amount.</small>
                    </span>
                    <span>{formatMoney(totals.fee)}</span>
                  </label>
                ) : null}
                <div className="total-line grand">
                  <span>Total</span>
                  <strong>{formatMoney(totals.total)}</strong>
                </div>
              </div>

              {error ? <p className="error-text">{error}</p> : null}

              <button className="buy-button" type="submit" disabled={submitting || !selected}>
                <Lock size={18} />
                {submitting ? "Redirecting to secure payment…" : props.buyButtonLabel}
              </button>
              <p className="secure-note">Secure payment by Stripe · your ticket numbers are emailed and shown after payment.</p>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
