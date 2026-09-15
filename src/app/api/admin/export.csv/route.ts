import { NextRequest, NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { getEntries } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csv(value: unknown): string {
  const text = value === undefined || value === null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

/** One row per entry, with the ticket numbers listed. */
export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const entries = await getEntries();
  const rows = [
    [
      "entry_id",
      "status",
      "buyer_name",
      "buyer_email",
      "buyer_phone",
      "package",
      "quantity",
      "tickets",
      "ticket_numbers",
      "subtotal",
      "fees_covered",
      "total",
      "created_at",
      "paid_at",
      "admin_notes"
    ]
  ];
  for (const entry of entries) {
    rows.push([
      entry.id,
      entry.status,
      entry.buyer.name,
      entry.buyer.email,
      entry.buyer.phone || "",
      `${entry.packageTickets} for $${(entry.packagePriceCents / 100).toFixed(0)}`,
      String(entry.quantity),
      String(entry.ticketCount),
      (entry.ticketNumbers || []).join(" "),
      (entry.subtotalCents / 100).toFixed(2),
      (entry.feeCoverCents / 100).toFixed(2),
      (entry.totalAmountCents / 100).toFixed(2),
      entry.createdAt,
      entry.paidAt || "",
      entry.adminNotes || ""
    ]);
  }
  const body = `﻿${rows.map((row) => row.map(csv).join(",")).join("\n")}\n`;
  return new NextResponse(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="kal-nidre-raffle-entries.csv"`
    }
  });
}
