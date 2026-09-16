import { NextRequest, NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { getLastSheetPush, isSheetConfigured, pushToSheet } from "@/lib/sheet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Status of the Google Sheet connection and the last push. */
export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  return NextResponse.json({ configured: isSheetConfigured(), lastPush: getLastSheetPush() || null });
}

/** Pushes the full current state to the Google Sheet now. */
export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const result = await pushToSheet();
  return NextResponse.json({ result }, { status: result.ok ? 200 : 502 });
}
