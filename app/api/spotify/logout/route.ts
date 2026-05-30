import { NextResponse } from "next/server";
import { clearTokenCookies } from "@/lib/spotify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  clearTokenCookies();
  return NextResponse.json({ ok: true });
}
