import { NextRequest, NextResponse } from "next/server";

import { createAdminToken, isPasswordValid, setAdminCookie } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { password?: string };
  if (!body.password || !isPasswordValid(body.password)) {
    return NextResponse.json({ error: "Invalid password." }, { status: 401 });
  }
  await setAdminCookie(createAdminToken());
  return NextResponse.json({ ok: true });
}
