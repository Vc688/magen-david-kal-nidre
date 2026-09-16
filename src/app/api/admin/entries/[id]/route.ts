import { NextRequest, NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { deleteEntry, updateEntryStatus } from "@/lib/store";
import { schedulePushToSheet } from "@/lib/sheet";
import type { EntryStatus } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const statuses: EntryStatus[] = ["pending", "paid", "expired", "canceled", "refunded"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const body = (await request.json()) as { status?: EntryStatus; adminNotes?: string };
  if (!body.status || !statuses.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }
  try {
    const { id } = await params;
    const entry = await updateEntryStatus(id, body.status, { adminNotes: body.adminNotes });
    schedulePushToSheet();
    return NextResponse.json({ entry });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update entry." },
      { status: 404 }
    );
  }
}

/** Permanently removes an entry (meant for test purchases). Ticket numbers are never reused. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const { id } = await params;
    await deleteEntry(id);
    schedulePushToSheet();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not delete entry." },
      { status: 404 }
    );
  }
}
