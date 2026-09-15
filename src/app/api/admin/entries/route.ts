import { NextRequest, NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { getSiteContent } from "@/lib/content";
import { getDraw, getEntries } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const [entries, draw, content] = await Promise.all([getEntries(), getDraw(), getSiteContent()]);
  return NextResponse.json({
    entries,
    draw: draw || null,
    settings: {
      drawAtIso: content.drawAtIso,
      campaignName: content.campaignName,
      announceWinner: content.announceWinner
    }
  });
}
