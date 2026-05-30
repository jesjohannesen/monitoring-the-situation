import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import {
  getEnv,
  callbackUrlFor,
  originFromRequest,
  SPOTIFY_SCOPES,
} from "@/lib/spotify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isProd = process.env.NODE_ENV === "production";

export async function GET(req: NextRequest) {
  const { clientId } = getEnv();
  const origin = originFromRequest(req);
  const redirect = callbackUrlFor(origin);

  // CSRF-protect the state. We also stash the return URL we want after auth.
  const state = crypto.randomBytes(16).toString("hex");
  const returnTo = req.nextUrl.searchParams.get("return_to") || "/";
  cookies().set("sp_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: 300,
  });
  cookies().set("sp_return", returnTo, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: 300,
  });

  const url = new URL("https://accounts.spotify.com/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", SPOTIFY_SCOPES);
  url.searchParams.set("redirect_uri", redirect);
  url.searchParams.set("state", state);
  // Force the dialog the first time so users see the scopes being requested.
  // Spotify silently re-uses the existing grant on subsequent logins.
  url.searchParams.set("show_dialog", "false");

  return NextResponse.redirect(url.toString());
}
