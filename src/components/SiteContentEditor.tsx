"use client";

import { Plus, RefreshCw, RotateCcw, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { defaultContent } from "@/data/site-content";
import type { SiteContent, TicketPackage } from "@/types";

type TextKey = {
  [K in keyof SiteContent]: SiteContent[K] extends string ? K : never;
}[keyof SiteContent];

type Field = {
  key: TextKey;
  label: string;
  hint?: string;
  multiline?: boolean;
  rows?: number;
};

const groups: { title: string; fields: Field[] }[] = [
  {
    title: "Identity",
    fields: [
      { key: "organizationName", label: "Synagogue name" },
      { key: "campaignName", label: "Campaign name", hint: "e.g. Kal Nidre Raffle 2026 — shown on receipts" },
      { key: "rabbiName", label: "Rabbi's name", hint: "replaces {rabbi} anywhere in the copy" },
      { key: "shulWebsiteLabel", label: "Shul link label" },
      { key: "shulWebsiteUrl", label: "Shul website URL" }
    ]
  },
  {
    title: "Hero & about",
    fields: [
      { key: "heroEyebrow", label: "Small label above the title" },
      { key: "heroTitle", label: "Title" },
      { key: "heroSubtitle", label: "Subtitle", multiline: true, rows: 2 },
      {
        key: "aboutBody",
        label: "About the raffle",
        hint: "separate paragraphs with a blank line; {rabbi} and {drawLabel} are replaced",
        multiline: true,
        rows: 6
      },
      { key: "drawLabel", label: "Drawing time as written", hint: "e.g. Saturday night, September 19th at 11:15 PM" }
    ]
  },
  {
    title: "Ticket section",
    fields: [
      { key: "packagesTitle", label: "Heading" },
      { key: "packagesSubtitle", label: "Subtitle", multiline: true, rows: 2 },
      { key: "buyButtonLabel", label: "Buy button text" }
    ]
  },
  {
    title: "After the drawing",
    fields: [
      { key: "closedTitle", label: "Closed heading" },
      { key: "closedBody", label: "Closed message", multiline: true, rows: 3 },
      { key: "winnerTitle", label: "Winner heading" },
      { key: "winnerBody", label: "Winner message", multiline: true, rows: 2 }
    ]
  },
  {
    title: "Thank-you page",
    fields: [
      { key: "successTitle", label: "Thank-you heading" },
      { key: "successBody", label: "Thank-you message", hint: "{rabbi} and {drawLabel} are replaced", multiline: true, rows: 3 }
    ]
  },
  {
    title: "Footer & contact",
    fields: [
      { key: "contactEmail", label: "Contact email" },
      { key: "footerNote", label: "Footer note", multiline: true, rows: 2 }
    ]
  }
];

/** ISO string with offset → the value a datetime-local input expects (local wall time). */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
}

/** datetime-local → ISO with the browser's timezone offset preserved. */
function fromLocalInput(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const pad = (n: number) => String(Math.abs(n)).padStart(2, "0");
  return `${value}:00${sign}${pad(Math.floor(Math.abs(offsetMinutes) / 60))}:${pad(offsetMinutes % 60)}`;
}

export default function SiteContentEditor() {
  const [content, setContent] = useState<SiteContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/content", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load content.");
      setContent(data.content as SiteContent);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load content.");
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

  function setField<K extends keyof SiteContent>(key: K, value: SiteContent[K]) {
    setContent((current) => (current ? { ...current, [key]: value } : current));
  }

  function setPackage(index: number, patch: Partial<TicketPackage>) {
    setContent((current) => {
      if (!current) return current;
      const packages = current.packages.map((pkg, i) => (i === index ? { ...pkg, ...patch } : pkg));
      return { ...current, packages };
    });
  }

  function addPackage() {
    setContent((current) =>
      current
        ? {
            ...current,
            packages: [...current.packages, { id: `package-${Date.now()}`, tickets: 1, priceCents: 10000, badge: "" }]
          }
        : current
    );
  }

  function removePackage(index: number) {
    setContent((current) =>
      current && current.packages.length > 1
        ? { ...current, packages: current.packages.filter((_, i) => i !== index) }
        : current
    );
  }

  async function save() {
    if (!content) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/content", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(content)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save.");
      setContent(data.content as SiteContent);
      setMessage("Saved. Your changes are live on the site.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  function resetToDefaults() {
    if (window.confirm("Reset every field back to the built-in defaults? You can still Save or leave without saving.")) {
      setContent({ ...defaultContent });
      setMessage("Defaults restored below — click Save to publish them.");
    }
  }

  if (loading || !content) {
    return (
      <div className="content-panel">
        <p className="content-intro">
          <RefreshCw size={16} className="spin" style={{ verticalAlign: "-3px", marginRight: 6 }} />
          Loading site content…
        </p>
        {message ? <p className="error-text">{message}</p> : null}
      </div>
    );
  }

  return (
    <div className="content-panel">
      <p className="content-intro">
        Edit the settings and any text on the public page here. Changes go live the moment you click{" "}
        <strong>Save</strong> — no code or redeploy needed. Leave a text field blank to fall back to the
        built-in default.
      </p>

      <div className="content-group">
        <h3>Drawing time</h3>
        <div className="content-field">
          <label htmlFor="drawAtIso">
            Raffle drawing at{" "}
            <span className="muted">— your local time; the countdown and ticket sales stop at this moment</span>
          </label>
          <input
            id="drawAtIso"
            type="datetime-local"
            value={toLocalInput(content.drawAtIso)}
            onChange={(event) => {
              const next = fromLocalInput(event.target.value);
              if (next) setField("drawAtIso", next);
            }}
          />
          <span className="muted small">Stored as {content.drawAtIso}</span>
        </div>
        <div className="content-toggles">
          <label className="check-inline">
            <input
              type="checkbox"
              checked={content.announceWinner}
              onChange={(event) => setField("announceWinner", event.target.checked)}
            />
            Announce the drawn winner on the public page
          </label>
          <label className="check-inline">
            <input
              type="checkbox"
              checked={content.allowFeeCover}
              onChange={(event) => setField("allowFeeCover", event.target.checked)}
            />
            Offer the “cover card processing fees” checkbox
          </label>
          <label className="check-inline">
            <input
              type="checkbox"
              checked={content.showHowItWorks}
              onChange={(event) => setField("showHowItWorks", event.target.checked)}
            />
            Show the “How it works” box next to the about text
          </label>
        </div>
      </div>

      <div className="content-group">
        <h3>Ticket packages</h3>
        <p className="content-intro" style={{ marginBottom: 12 }}>
          Buyers pick one package and can buy it more than once (up to the max below).
        </p>
        <div className="package-rows">
          <div className="package-row package-row-head">
            <span>Tickets</span>
            <span>Price ($)</span>
            <span>Badge (optional)</span>
            <span />
          </div>
          {content.packages.map((pkg, index) => (
            <div className="package-row" key={pkg.id}>
              <input
                type="number"
                min={1}
                value={pkg.tickets}
                onChange={(event) => setPackage(index, { tickets: Math.max(1, Math.round(Number(event.target.value) || 1)) })}
              />
              <input
                type="number"
                min={1}
                value={pkg.priceCents / 100}
                onChange={(event) =>
                  setPackage(index, { priceCents: Math.max(100, Math.round((Number(event.target.value) || 0) * 100)) })
                }
              />
              <input
                value={pkg.badge}
                onChange={(event) => setPackage(index, { badge: event.target.value })}
                placeholder="e.g. Best value"
              />
              <button
                type="button"
                className="icon-button"
                onClick={() => removePackage(index)}
                disabled={content.packages.length <= 1}
                aria-label="Remove package"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <div className="content-field" style={{ marginTop: 12 }}>
          <button type="button" className="btn" onClick={addPackage} style={{ justifySelf: "start" }}>
            <Plus size={16} />
            Add package
          </button>
        </div>
        <div className="content-field" style={{ marginTop: 12 }}>
          <label htmlFor="maxQuantity">Max packages per purchase</label>
          <input
            id="maxQuantity"
            type="number"
            min={1}
            max={50}
            value={content.maxQuantity}
            onChange={(event) => setField("maxQuantity", Math.min(50, Math.max(1, Math.round(Number(event.target.value) || 1))))}
          />
        </div>
      </div>

      {groups.map((group) => (
        <div className="content-group" key={group.title}>
          <h3>{group.title}</h3>
          {group.fields.map((field) => (
            <div className="content-field" key={field.key}>
              <label htmlFor={field.key}>
                {field.label}
                {field.hint ? <span className="muted"> — {field.hint}</span> : null}
              </label>
              {field.multiline ? (
                <textarea
                  id={field.key}
                  value={content[field.key]}
                  onChange={(event) => setField(field.key, event.target.value)}
                  rows={field.rows || 2}
                />
              ) : (
                <input
                  id={field.key}
                  value={content[field.key]}
                  onChange={(event) => setField(field.key, event.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      ))}

      {message ? <p className="status-message">{message}</p> : null}

      <div className="content-actions">
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          <Save size={17} />
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button className="btn" onClick={resetToDefaults} disabled={saving}>
          <RotateCcw size={16} />
          Restore defaults
        </button>
      </div>
    </div>
  );
}
