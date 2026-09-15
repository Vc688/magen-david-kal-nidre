"use client";

import {
  Award,
  ClipboardList,
  CloudDownload,
  Download,
  Lock,
  LogOut,
  Pencil,
  RefreshCw,
  Save,
  Search,
  Trash2
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import SiteContentEditor from "@/components/SiteContentEditor";
import { formatMoney } from "@/lib/money";
import type { DrawResult, Entry, EntryStatus } from "@/types";

type AdminResponse = {
  entries: Entry[];
  draw: DrawResult | null;
  settings: { drawAtIso: string; campaignName: string; announceWinner: boolean };
};

type Tab = "entries" | "content";

const statuses: EntryStatus[] = ["paid", "pending", "expired", "canceled", "refunded"];

export default function AdminDashboard() {
  const [password, setPassword] = useState("");
  const [authorized, setAuthorized] = useState<boolean | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("entries");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draw, setDraw] = useState<DrawResult | null>(null);
  const [settings, setSettings] = useState<AdminResponse["settings"] | undefined>();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("paid");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/entries", { cache: "no-store" });
      if (response.status === 401) {
        setAuthorized(false);
        return;
      }
      const data = (await response.json()) as AdminResponse;
      setEntries(data.entries);
      setDraw(data.draw);
      setSettings(data.settings);
      setAuthorized(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load entries.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function login(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password })
    });
    if (!response.ok) {
      setMessage("Invalid password.");
      return;
    }
    setPassword("");
    await load();
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthorized(false);
    setEntries([]);
  }

  async function update(id: string, status: EntryStatus, adminNotes?: string) {
    setMessage("");
    const response = await fetch(`/api/admin/entries/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, adminNotes })
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Could not update entry.");
      return;
    }
    setEntries((current) => current.map((item) => (item.id === id ? data.entry : item)));
    setMessage("Saved.");
  }

  async function remove(entry: Entry) {
    if (
      !window.confirm(
        `Delete the entry for ${entry.buyer.name} (${formatMoney(entry.totalAmountCents)})? This is meant for test purchases. It does not refund anything in Stripe. Sync from Stripe will not re-import it, and its ticket numbers are retired (numbering restarts at #1 only if no other tickets exist).`
      )
    ) {
      return;
    }
    setMessage("");
    const response = await fetch(`/api/admin/entries/${entry.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Could not delete entry.");
      return;
    }
    setEntries((current) => current.filter((item) => item.id !== entry.id));
    if (draw?.entryId === entry.id) setDraw(null);
    setMessage("Entry deleted.");
  }

  async function syncFromStripe() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/sync", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Sync failed.");
      const r = data.result as { scanned: number; added: string[]; markedPaid: string[]; alreadyCurrent: number };
      setMessage(
        `Stripe sync: ${r.scanned} paid checkout${r.scanned === 1 ? "" : "s"} found — ${r.added.length} recovered, ${r.markedPaid.length} updated, ${r.alreadyCurrent} already up to date.`
      );
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sync failed.");
      setLoading(false);
    }
  }

  const paidEntries = entries.filter((entry) => entry.status === "paid");
  const metrics = {
    paidEntries: paidEntries.length,
    paidTickets: paidEntries.reduce((sum, entry) => sum + entry.ticketCount, 0),
    revenue: paidEntries.reduce((sum, entry) => sum + entry.totalAmountCents, 0),
    feesCovered: paidEntries.reduce((sum, entry) => sum + entry.feeCoverCents, 0)
  };

  async function runDraw() {
    const paidTickets = metrics.paidTickets;
    const confirmText = draw
      ? "A winner has already been drawn. Draw again and replace the current result?"
      : `Draw one winning ticket at random from ${paidTickets} paid tickets?`;
    if (!window.confirm(confirmText)) return;
    setMessage("");
    const response = await fetch("/api/admin/draw", { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Draw failed.");
      return;
    }
    setDraw(data.draw);
    setMessage(`Winner drawn: ticket #${data.draw.ticketNumber} — ${data.draw.winnerName}.`);
  }

  async function clearDraw() {
    if (!window.confirm("Clear the recorded draw result?")) return;
    await fetch("/api/admin/draw", { method: "DELETE" });
    setDraw(null);
    setMessage("Draw cleared.");
  }

  const filtered = entries.filter((entry) => {
    const text = `${entry.id} ${entry.status} ${entry.buyer.name} ${entry.buyer.email} ${entry.buyer.phone || ""} ${(
      entry.ticketNumbers || []
    )
      .map((n) => `#${n}`)
      .join(" ")}`.toLowerCase();
    const matchesText = text.includes(query.toLowerCase());
    const matchesStatus = statusFilter === "all" || entry.status === statusFilter;
    return matchesText && matchesStatus;
  });

  const winnerEntry = draw ? entries.find((entry) => entry.id === draw.entryId) : undefined;

  if (authorized === false) {
    return (
      <main className="admin-shell login-shell">
        <form className="login-card" onSubmit={login}>
          <span className="login-icon">
            <Lock size={28} />
          </span>
          <h1>Raffle Admin</h1>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Admin password"
            required
          />
          {message ? <p className="error-text">{message}</p> : null}
          <button className="buy-button">
            <Lock size={18} />
            Sign in
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Congregation Magen David of West Deal</p>
          <h1>{settings?.campaignName || "Kal Nidre Raffle"} Admin</h1>
        </div>
        <div className="admin-actions">
          <a className="btn" href="/" target="_blank" rel="noopener noreferrer">
            View site
          </a>
          <a className="btn" href="/api/admin/export.csv">
            <Download size={17} />
            Export CSV
          </a>
          <button className="btn" onClick={load} disabled={loading}>
            <RefreshCw size={17} className={loading ? "spin" : ""} />
            Refresh
          </button>
          <button
            className="btn"
            onClick={syncFromStripe}
            disabled={loading}
            title="Pull every paid raffle checkout from Stripe and fix any missing or pending records"
          >
            <CloudDownload size={17} />
            Sync from Stripe
          </button>
          <button className="btn" onClick={logout}>
            <LogOut size={17} />
            Logout
          </button>
        </div>
      </header>

      <div className="admin-tabs">
        <button className={tab === "entries" ? "active" : ""} onClick={() => setTab("entries")}>
          <ClipboardList size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />
          Entries &amp; drawing
        </button>
        <button className={tab === "content" ? "active" : ""} onClick={() => setTab("content")}>
          <Pencil size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />
          Site content &amp; settings
        </button>
      </div>

      {tab === "content" ? (
        <SiteContentEditor />
      ) : (
        <>
          <section className="admin-metrics">
            <AdminMetric label="Tickets sold" value={metrics.paidTickets.toLocaleString()} />
            <AdminMetric label="Paid entries" value={metrics.paidEntries.toLocaleString()} />
            <AdminMetric label="Total collected" value={formatMoney(metrics.revenue)} />
            <AdminMetric label="Fees covered by buyers" value={formatMoney(metrics.feesCovered)} />
          </section>

          <section className="draw-panel">
            <div className="draw-head">
              <h2>
                <Award size={20} />
                The drawing
              </h2>
              <p className="muted">
                Scheduled {settings ? new Date(settings.drawAtIso).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "full", timeStyle: "short" }) : ""}{" "}
                (New York). Change it in Site content &amp; settings.
              </p>
            </div>
            {draw ? (
              <div className="draw-result">
                <p className="draw-ticket">Ticket #{draw.ticketNumber}</p>
                <p className="draw-name">{draw.winnerName}</p>
                <p className="muted">
                  {winnerEntry ? `${winnerEntry.buyer.email}${winnerEntry.buyer.phone ? ` · ${winnerEntry.buyer.phone}` : ""} · ` : ""}
                  drawn {new Date(draw.drawnAt).toLocaleString()}
                </p>
                <p className="muted">
                  {settings?.announceWinner
                    ? "The winner is announced on the public site."
                    : "Not yet shown publicly — turn on “Announce winner” in Site content & settings to show it."}
                </p>
                <div className="draw-actions">
                  <button className="btn" onClick={runDraw}>
                    Draw again
                  </button>
                  <button className="btn" onClick={clearDraw}>
                    Clear result
                  </button>
                </div>
              </div>
            ) : (
              <div className="draw-actions">
                <button className="buy-button compact" onClick={runDraw} disabled={metrics.paidTickets === 0}>
                  <Award size={18} />
                  Draw the winner
                </button>
                <span className="muted">
                  Picks one ticket at random from all {metrics.paidTickets} paid tickets, so odds match tickets held.
                </span>
              </div>
            )}
          </section>

          <section className="orders-panel">
            <div className="orders-toolbar">
              <label className="search-box">
                <Search size={18} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by name, email, or ticket #"
                />
              </label>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="paid">Paid</option>
                <option value="all">All statuses</option>
                {statuses
                  .filter((status) => status !== "paid")
                  .map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
              </select>
            </div>
            {message ? <p className="status-message">{message}</p> : null}
            {statusFilter === "paid" && entries.length > filtered.length ? (
              <p className="muted small" style={{ margin: "0 0 12px" }}>
                {entries.length - filtered.length} non-paid (pending / expired / canceled) hidden —{" "}
                <button className="link-button" onClick={() => setStatusFilter("all")}>
                  show all statuses
                </button>
                . If someone paid but shows as pending, click <strong>Sync from Stripe</strong>.
              </p>
            ) : null}
            <div className="orders-list">
              {filtered.length === 0 ? (
                <p className="muted">No entries match this view.</p>
              ) : (
                filtered.map((entry) => (
                  <EntryCard
                    key={`${entry.id}-${entry.updatedAt}`}
                    entry={entry}
                    isWinner={draw?.entryId === entry.id}
                    onUpdate={update}
                    onDelete={remove}
                  />
                ))
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function AdminMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EntryCard({
  entry,
  isWinner,
  onUpdate,
  onDelete
}: {
  entry: Entry;
  isWinner: boolean;
  onUpdate: (id: string, status: EntryStatus, adminNotes?: string) => Promise<void>;
  onDelete: (entry: Entry) => Promise<void>;
}) {
  const [status, setStatus] = useState<EntryStatus>(entry.status);
  const [notes, setNotes] = useState(entry.adminNotes || "");

  return (
    <article className={`order-card status-${entry.status}${isWinner ? " winner" : ""}`}>
      <div className="order-top">
        <div>
          <h2>{entry.buyer.name}</h2>
          <p>
            {entry.buyer.email}
            {entry.buyer.phone ? ` / ${entry.buyer.phone}` : ""}
          </p>
          <p>
            <span className={`pill pill-${entry.status}`}>{entry.status}</span>
            {isWinner ? <span className="pill pill-winner">Winner</span> : null}
          </p>
        </div>
        <div className="order-total">
          <strong>{formatMoney(entry.totalAmountCents)}</strong>
          <span>
            {entry.quantity} × ({entry.packageTickets} for {formatMoney(entry.packagePriceCents)})
            {entry.feeCoverCents > 0 ? " + fees" : ""}
          </span>
        </div>
      </div>
      <div className="ticket-numbers">
        {(entry.ticketNumbers || []).map((n) => (
          <span className="ticket-chip" key={n}>
            #{n}
          </span>
        ))}
        {!entry.ticketNumbers?.length ? (
          <span className="muted small">
            {entry.ticketCount} {entry.ticketCount === 1 ? "ticket" : "tickets"} — numbers assigned when paid
          </span>
        ) : null}
      </div>
      <div className="order-controls">
        <select value={status} onChange={(event) => setStatus(event.target.value as EntryStatus)}>
          {statuses.map((option) => (
            <option value={option} key={option}>
              {option}
            </option>
          ))}
        </select>
        <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Admin notes" />
        <button className="btn btn-primary" onClick={() => onUpdate(entry.id, status, notes)}>
          <Save size={16} />
          Save
        </button>
        <button className="icon-button" onClick={() => onDelete(entry)} title="Delete entry (test purchases)" aria-label="Delete entry">
          <Trash2 size={16} />
        </button>
      </div>
      <p className="order-meta">
        {entry.id} / {new Date(entry.createdAt).toLocaleString()}
        {entry.paidAt ? ` / paid ${new Date(entry.paidAt).toLocaleString()}` : ""}
        {entry.stripePaymentIntentId ? ` / ${entry.stripePaymentIntentId}` : ""}
      </p>
    </article>
  );
}
