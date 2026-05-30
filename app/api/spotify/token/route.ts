import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/spotify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Returns the current Spotify access token to the browser (refreshing if
// necessary). The Web Playback SDK's getOAuthToken callback hits this.
// The token is short-lived (~1h) and the user is already on our origin, so
// surfacing it via JSON is acceptable. The long-lived refresh token stays
// in an httpOnly cookie and never leaves the server.
export async function GET() {
  const access = await getValidAccessToken();
  if (!access) {
    return NextResponse.json({ error: "not_logged_in" }, { status: 401 });
  }
  return NextResponse.json(
    { access_token: access },
    { headers: { "cache-control": "no-store" } },
  );
}
