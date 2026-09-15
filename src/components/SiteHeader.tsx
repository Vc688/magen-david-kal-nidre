import Image from "next/image";
import Link from "next/link";

import type { SiteContent } from "@/types";

export default function SiteHeader({ content }: { content: SiteContent }) {
  return (
    <header className="site-header">
      <Link href="/" className="site-logo">
        <Image src="/logo.png" alt={content.organizationName} width={551} height={125} priority />
      </Link>
      <a className="site-link" href={content.shulWebsiteUrl} target="_blank" rel="noopener noreferrer">
        {content.shulWebsiteLabel}
      </a>
    </header>
  );
}
