import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  callbackUrlFor,
  exchangeCodeForTokens,
  originFromRequest,
  writeTokenCookies,
} from "@/lib/spotify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const origin = originFromRequest(req);
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const jar = cookies();
  const savedState = jar.get("sp_state")?.value;
  const returnTo = jar.get("sp_return")?.value || "/";
  // Always clean up the one-shot cookies.
  jar.set("sp_state", "", { path: "/", maxAge: 0 });
  jar.set("sp_return", "", { path: "/", maxAge: 0 });

  function landWith(params: Record<string, string>): NextResponse {
    const dest = new URL(returnTo, origin);
    for (const [k, v] of Object.entries(params)) dest.searchParams.set(k, v);
    return NextResponse.redirect(dest);
  }

  if (error) return landWith({ spotify: "denied" });
  if (!code || !state) return landWith({ spotify: "bad_request" });
  if (!savedState || savedState !== state) {
    return landWith({ spotify: "bad_state" });
  }

  try {
    const tokens = await exchangeCodeForTokens(code, callbackUrlFor(origin));
    writeTokenCookies(tokens);
    return landWith({ spotify: "ok" });
  } catch (e) {
    console.error("[spotify] callback failed", e);
    return landWith({ spotify: "exchange_failed" });
  }
}
