import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/spotify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Resolves a song to a Spotify track. Pass either ?q=title artist or
// individual ?title= and ?artist= params. Returns the top track.
export async function GET(req: NextRequest) {
  const access = await getValidAccessToken();
  if (!access) {
    return NextResponse.json({ error: "not_logged_in" }, { status: 401 });
  }

  const title = req.nextUrl.searchParams.get("title");
  const artist = req.nextUrl.searchParams.get("artist");
  const free = req.nextUrl.searchParams.get("q");

  let q = free || "";
  if (!q && title) {
    q = artist ? `track:${title} artist:${artist}` : `track:${title}`;
  }
  if (!q) {
    return NextResponse.json({ error: "missing query" }, { status: 400 });
  }

  const u = new URL("https://api.spotify.com/v1/search");
  u.searchParams.set("q", q);
  u.searchParams.set("type", "track");
  u.searchParams.set("limit", "1");
  const res = await fetch(u, {
    headers: { authorization: `Bearer ${access}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return NextResponse.json(
      { error: "spotify_search_failed", detail },
      { status: 502 },
    );
  }
  const data = (await res.json()) as {
    tracks?: {
      items?: Array<{
        id: string;
        uri: string;
        name: string;
        external_urls?: { spotify?: string };
        album?: {
          name?: string;
          images?: Array<{ url: string; width: number; height: number }>;
        };
        artists?: Array<{ name: string }>;
      }>;
    };
  };
  const top = data.tracks?.items?.[0];
  if (!top) return NextResponse.json({ track: null });
  return NextResponse.json({
    track: {
      id: top.id,
      uri: top.uri,
      name: top.name,
      artist: top.artists?.map((a) => a.name).join(", "),
      album: top.album?.name,
      album_art: top.album?.images?.[0]?.url,
      external_url: top.external_urls?.spotify,
    },
  });
}
