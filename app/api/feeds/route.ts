import { NextRequest, NextResponse } from "next/server";
import { fetchAndParseFeed } from "@/lib/rss";
import { getSourceById } from "@/lib/feedCatalog";

export const runtime = "nodejs";
export const revalidate = 900; // 15 min ISR

/**
 * /api/feeds?id=<source-id>
 *   — preferred; the URL is looked up in the catalog so we don't act as
 *   an open proxy for arbitrary hosts.
 *
 * /api/feeds?url=<raw-url>
 *   — escape hatch for adhoc sources; restricted to http(s). Use sparingly.
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const rawUrl = req.nextUrl.searchParams.get("url");

  let url: string | null = null;
  if (id) {
    const src = getSourceById(id);
    if (!src) {
      return NextResponse.json({ error: "unknown source" }, { status: 404 });
    }
    url = src.url;
  } else if (rawUrl) {
    try {
      const u = new URL(rawUrl);
      if (u.protocol !== "https:" && u.protocol !== "http:") {
        return NextResponse.json({ error: "bad protocol" }, { status: 400 });
      }
      url = rawUrl;
    } catch {
      return NextResponse.json({ error: "bad url" }, { status: 400 });
    }
  } else {
    return NextResponse.json({ error: "missing id or url" }, { status: 400 });
  }

  try {
    const feed = await fetchAndParseFeed(url);
    return NextResponse.json(
      { feed },
      {
        headers: {
          "cache-control":
            "public, s-maxage=900, stale-while-revalidate=3600",
        },
      },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "fetch failed" },
      { status: 502 },
    );
  }
}
