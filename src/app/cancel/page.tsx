import { CircleX } from "lucide-react";
import Link from "next/link";

import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { getSiteContent } from "@/lib/content";

export const dynamic = "force-dynamic";

export default async function CancelPage({
  searchParams
}: {
  searchParams: Promise<{ entry_id?: string }>;
}) {
  const { entry_id } = await searchParams;
  const content = await getSiteContent();

  return (
    <main className="page">
      <SiteHeader content={content} />
      <div className="content">
        <section className="system-card">
          <span className="system-icon warn">
            <CircleX size={40} />
          </span>
          <h1>Payment canceled</h1>
          <p>
            No worries — your card was not charged and no tickets were issued. You can go back and try
            again whenever you are ready.
          </p>
          {entry_id ? <p className="muted">Reference: {entry_id}</p> : null}
          <div className="system-actions">
            <Link href="/#tickets" className="hero-cta">
              Back to tickets
            </Link>
          </div>
        </section>
      </div>
      <SiteFooter content={content} />
    </main>
  );
}
