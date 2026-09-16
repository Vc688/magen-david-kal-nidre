import { NextRequest, NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { clearDraw, drawWinner } from "@/lib/store";
import { schedulePushToSheet } from "@/lib/sheet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Draws a winning ticket at random from every paid ticket. */
export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const draw = await drawWinner();
    schedulePushToSheet();
    return NextResponse.json({ draw });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Draw failed." },
      { status: 400 }
    );
  }
}

/** Clears the recorded draw so it can be redone (e.g. a test draw). */
export async function DELETE(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  await clearDraw();
  schedulePushToSheet();
  return NextResponse.json({ ok: true });
}
