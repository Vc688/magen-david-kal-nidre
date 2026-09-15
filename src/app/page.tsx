import { Award, HandHeart, Ticket } from "lucide-react";

import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import TicketShop from "@/components/TicketShop";
import { fillCopy, getSiteContent, isSalesOpen, paragraphs } from "@/lib/content";
import { getDraw } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [content, draw] = await Promise.all([getSiteContent(), getDraw()]);
  const open = isSalesOpen(content);
  const showWinner = content.announceWinner && draw;

  return (
    <main className="page">
      <SiteHeader content={content} />

      <section className="hero">
        <div className="hero-inner">
          <p className="eyebrow">{content.heroEyebrow}</p>
          <h1>{content.heroTitle}</h1>
          <p className="hero-sub">{fillCopy(content.heroSubtitle, content)}</p>
          {open ? (
            <a href="#tickets" className="hero-cta">
              <Ticket size={18} />
              {content.buyButtonLabel}
            </a>
          ) : null}
        </div>
      </section>

      <div className="content">
        <TicketShop
          key={content.drawAtIso}
          initiallyOpen={open}
          drawAtIso={content.drawAtIso}
          drawLabel={content.drawLabel}
          packages={content.packages}
          allowFeeCover={content.allowFeeCover}
          maxQuantity={content.maxQuantity}
          organizationName={content.organizationName}
          packagesTitle={content.packagesTitle}
          packagesSubtitle={fillCopy(content.packagesSubtitle, content)}
          buyButtonLabel={content.buyButtonLabel}
          closedTitle={content.closedTitle}
          closedBody={fillCopy(content.closedBody, content)}
          contactEmail={content.contactEmail}
          winner={
            showWinner
              ? {
                  title: content.winnerTitle,
                  name: draw.winnerName,
                  ticketNumber: draw.ticketNumber,
                  body: fillCopy(content.winnerBody, content)
                }
              : undefined
          }
        />

        <section className={`section about${content.showHowItWorks ? "" : " about-solo"}`}>
          <div className="about-text">
            <h2>About the raffle</h2>
            {paragraphs(fillCopy(content.aboutBody, content)).map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          {content.showHowItWorks ? (
          <aside className="how">
            <h3>How it works</h3>
            <ol>
              <li>
                <Ticket size={20} />
                <div>
                  <strong>Buy your tickets</strong>
                  <span>Choose a package above and pay securely online.</span>
                </div>
              </li>
              <li>
                <HandHeart size={20} />
                <div>
                  <strong>Mi Sheberach for everyone</strong>
                  <span>{content.rabbiName} includes every participant in the Mi Sheberach.</span>
                </div>
              </li>
              <li>
                <Award size={20} />
                <div>
                  <strong>The drawing</strong>
                  <span>
                    {content.drawLabel}. The winner holds the Sefer Torah during Kal Nidre.
                  </span>
                </div>
              </li>
            </ol>
          </aside>
          ) : null}
        </section>
      </div>

      <SiteFooter content={content} />
    </main>
  );
}
