import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/spotify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fetches the current user's Spotify profile. Used by the UI to decide
// whether to show "log in" or the play widget. Returns the bare minimum we
// need: display_name + product (so we can tell premium vs free).
export async function GET() {
  const access = await getValidAccessToken();
  if (!access) {
    return NextResponse.json({ logged_in: false }, { status: 200 });
  }
  const res = await fetch("https://api.spotify.com/v1/me", {
    headers: { authorization: `Bearer ${access}` },
    cache: "no-store",
  });
  if (!res.ok) {
    return NextResponse.json({ logged_in: false }, { status: 200 });
  }
  const data = (await res.json()) as {
    display_name?: string;
    id?: string;
    product?: string;
    email?: string;
  };
  return NextResponse.json(
    {
      logged_in: true,
      display_name: data.display_name ?? data.id ?? "",
      product: data.product ?? "unknown",
    },
    { headers: { "cache-control": "no-store" } },
  );
}
