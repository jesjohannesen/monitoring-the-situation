import { NextRequest, NextResponse } from "next/server";
import { extractPreview } from "@/lib/extract";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "missing url" }, { status: 400 });
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "unsupported scheme" }, { status: 400 });
  }

  const data = await extractPreview(parsed.toString());

  return NextResponse.json(data, {
    headers: {
      // Modest CDN-friendly cache: cards don't change often per article.
      "cache-control": "public, max-age=300, s-maxage=21600",
    },
  });
}
