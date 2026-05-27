import { XMLParser } from "fast-xml-parser";

export type RssItem = {
  source: string;
  title: string;
  link: string;
  pubDate: Date;
  description: string;
};

export const FEEDS: Array<{ source: string; url: string }> = [
  { source: "WSJ", url: "https://feeds.a.dj.com/rss/RSSWorldNews.xml" },
  { source: "WSJ", url: "https://feeds.a.dj.com/rss/RSSWSJD.xml" },
  { source: "WSJ", url: "https://feeds.a.dj.com/rss/RSSMarketsMain.xml" },
  { source: "Economist", url: "https://www.economist.com/the-world-this-week/rss.xml" },
  { source: "Economist", url: "https://www.economist.com/latest/rss.xml" },
  { source: "Wired", url: "https://www.wired.com/feed/rss" },
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

async function fetchFeed(source: string, url: string): Promise<RssItem[]> {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "briefing-generator/0.1 (+https://github.com — personal news briefing)",
    },
  });
  if (!res.ok) {
    console.error(`[rss] ${source} ${url} -> ${res.status}`);
    return [];
  }
  const xml = await res.text();
  const parsed = parser.parse(xml);

  // RSS 2.0: rss.channel.item[]   Atom: feed.entry[]
  const channelItems = parsed?.rss?.channel?.item;
  const atomEntries = parsed?.feed?.entry;
  const rawItems: any[] = channelItems
    ? Array.isArray(channelItems)
      ? channelItems
      : [channelItems]
    : atomEntries
      ? Array.isArray(atomEntries)
        ? atomEntries
        : [atomEntries]
      : [];

  return rawItems.map((it) => {
    const title = stripHtml(String(it.title?.["#text"] ?? it.title ?? ""));
    const link =
      typeof it.link === "string"
        ? it.link
        : (it.link?.["@_href"] ?? it.link?.["#text"] ?? "");
    const pubRaw = it.pubDate ?? it.published ?? it.updated ?? "";
    const pubDate = pubRaw ? new Date(pubRaw) : new Date(0);
    const description = stripHtml(
      String(it.description ?? it.summary?.["#text"] ?? it.summary ?? ""),
    );
    return { source, title, link, pubDate, description };
  });
}

export async function fetchAllRecent(hours = 24): Promise<RssItem[]> {
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  const all = await Promise.all(FEEDS.map((f) => fetchFeed(f.source, f.url)));
  return all
    .flat()
    .filter((it) => it.title && it.pubDate.getTime() >= cutoff)
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
}
