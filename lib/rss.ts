/**
 * Minimal RSS 2.0 + Atom parser. Returns a normalized shape we can render
 * uniformly. Uses fast-xml-parser under the hood and runs on the server
 * (the /api/feeds route), so CORS / cookies / etc. aren't a concern.
 */

import { XMLParser } from "fast-xml-parser";

export type FeedItem = {
  title: string;
  url: string;
  published_at?: string;
  summary?: string;
  thumbnail?: string;
};

export type Feed = {
  title: string;
  items: FeedItem[];
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  textNodeName: "#text",
  // fast-xml-parser's default caps entity references at 1000 per document
  // as a billion-laughs guard. Real feeds (Atom especially) routinely blow
  // through that — Simon Willison's full-content feed hits ~3-4k char refs.
  // Raise both limits to generous-but-finite ceilings: still rejects a
  // malicious feed, but parses normal full-content Atom without issue.
  processEntities: {
    enabled: true,
    maxTotalExpansions: 100000,
    maxExpandedLength: 10_000_000,
  },
});

function asString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o["#text"] === "string") return o["#text"];
    if (typeof o["#text"] === "number") return String(o["#text"]);
  }
  return "";
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/**
 * Try to pull a thumbnail URL out of an item, walking the common feed
 * conventions in priority order:
 *   1. <media:thumbnail url="...">
 *   2. <media:content url="..." medium="image" | type="image/*">
 *   3. <enclosure url="..." type="image/*">  (RSS 2.0)
 *   4. <itunes:image href="...">             (podcast feeds)
 *   5. <image> child (some bespoke feeds use this)
 *   6. First <img src="..."> in description / content / summary HTML
 * Returns undefined if none of these yields a URL.
 */
function pickImage(it: Record<string, unknown>): string | undefined {
  // 1. media:thumbnail
  for (const m of asArray(it["media:thumbnail"] as unknown)) {
    const url = asString((m as Record<string, unknown>)["@_url"]);
    if (url) return url;
  }
  // 2. media:content (image-typed only)
  for (const m of asArray(it["media:content"] as unknown)) {
    const o = m as Record<string, unknown>;
    const url = asString(o["@_url"]);
    const type = asString(o["@_type"]);
    const medium = asString(o["@_medium"]);
    if (url && (medium === "image" || type.startsWith("image/"))) return url;
  }
  // 3. enclosure (image-typed only)
  for (const m of asArray(it.enclosure as unknown)) {
    const o = m as Record<string, unknown>;
    const url = asString(o["@_url"]);
    const type = asString(o["@_type"]);
    if (url && type.startsWith("image/")) return url;
  }
  // 4. itunes:image
  const ituImg = it["itunes:image"];
  if (ituImg) {
    const url = asString((ituImg as Record<string, unknown>)["@_href"]);
    if (url) return url;
  }
  // 5. <image> child
  const img = it.image;
  if (img) {
    if (typeof img === "string") return img;
    const o = img as Record<string, unknown>;
    const url =
      asString(o.url) || asString(o["@_url"]) || asString(o["@_href"]);
    if (url) return url;
  }
  // 6. Inline <img> in any HTML body field
  const htmlBody =
    asString(it["content:encoded"]) ||
    asString(it.description) ||
    asString(it.content) ||
    asString(it.summary);
  if (htmlBody) {
    const match = htmlBody.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (match) return match[1];
  }
  return undefined;
}

// Pick the canonical link from an Atom <link>. Atom links can be a single
// string, a single object with @_href, or an array of such objects with
// rel="alternate" / "self" / "edit" etc — we want "alternate" or the first.
function atomLink(linkField: unknown): string {
  if (!linkField) return "";
  if (typeof linkField === "string") return linkField;
  if (Array.isArray(linkField)) {
    const arr = linkField as Array<Record<string, unknown>>;
    const alt = arr.find(
      (l) => !l["@_rel"] || l["@_rel"] === "alternate",
    );
    return asString(alt?.["@_href"] ?? arr[0]?.["@_href"]);
  }
  const o = linkField as Record<string, unknown>;
  return asString(o["@_href"] ?? o["#text"]);
}

export async function fetchAndParseFeed(url: string): Promise<Feed> {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "briefing-rss/1.0 (+https://monitoring-the-situation-one.vercel.app)",
      accept:
        "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    },
    // Vercel edge cache: 15 min, serve stale up to 1h while revalidating.
    next: { revalidate: 900 },
  });
  if (!res.ok) {
    throw new Error(`upstream ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  const parsed = parser.parse(text) as Record<string, unknown>;

  // RSS 2.0
  const rss = parsed.rss as Record<string, unknown> | undefined;
  if (rss?.channel) {
    const ch = rss.channel as Record<string, unknown>;
    const items = asArray(ch.item as unknown);
    return {
      title: asString(ch.title) || "feed",
      items: items.map((raw) => {
        const it = raw as Record<string, unknown>;
        return {
          title: asString(it.title),
          url: asString(it.link),
          published_at: asString(it.pubDate) || undefined,
          summary: stripHtml(asString(it.description)).slice(0, 280) || undefined,
          thumbnail: pickImage(it),
        };
      }),
    };
  }

  // Atom
  const fd = parsed.feed as Record<string, unknown> | undefined;
  if (fd) {
    const entries = asArray(fd.entry as unknown);
    return {
      title: asString(fd.title) || "feed",
      items: entries.map((raw) => {
        const e = raw as Record<string, unknown>;
        return {
          title: asString(e.title),
          url: atomLink(e.link),
          published_at:
            asString(e.published) || asString(e.updated) || undefined,
          summary:
            stripHtml(asString(e.summary) || asString(e.content)).slice(
              0,
              280,
            ) || undefined,
          thumbnail: pickImage(e),
        };
      }),
    };
  }

  throw new Error("unrecognized feed format");
}
