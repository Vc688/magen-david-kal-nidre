import type { SiteContent } from "@/types";

export default function SiteFooter({ content }: { content: SiteContent }) {
  return (
    <footer className="site-footer">
      <p>{content.footerNote}</p>
      <p>
        Questions? <a href={`mailto:${content.contactEmail}`}>{content.contactEmail}</a> ·{" "}
        <a href={content.shulWebsiteUrl} target="_blank" rel="noopener noreferrer">
          {content.shulWebsiteLabel}
        </a>
      </p>
    </footer>
  );
}
