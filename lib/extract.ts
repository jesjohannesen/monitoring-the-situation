// Minimal HTML extractor — no deps. Returns a title, an excerpt, and the host.
// Brittle on purpose: we'd rather return a small but honest excerpt than pull
// in a full readability/dom parser. Pages whose body text isn't in <p> tags
// (heavy JS sites, paywalls) will just yield a shorter excerpt or none.

export type Extracted = {
  title?: string;
  excerpt?: string;
  host?: string;
};

const SCRIPT_STYLE = /<(script|style|noscript|template)[^>]*>[\s\S]*?<\/\1>/gi;
const TAG = /<[^>]+>/g;
const WS = /\s+/g;
const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, ent) => {
    if (ent[0] === "#") {
      const code =
        ent[1] === "x" || ent[1] === "X"
          ? parseInt(ent.slice(2), 16)
          : parseInt(ent.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    }
    return HTML_ENTITIES[ent.toLowerCase()] ?? "";
  });
}

function pickMeta(
  html: string,
  keys: Array<{ attr: "property" | "name"; value: string }>,
): string | undefined {
  // Find all <meta ...> tags once, then pick the first that matches any key.
  const metas = html.match(/<meta\b[^>]*>/gi) ?? [];
  const getAttr = (tag: string, name: string): string | undefined => {
    const m = new RegExp(`\\b${name}=["']([^"']+)["']`, "i").exec(tag);
    return m ? m[1] : undefined;
  };
  for (const { attr, value } of keys) {
    for (const tag of metas) {
      const a = getAttr(tag, attr);
      if (!a || a.toLowerCase() !== value.toLowerCase()) continue;
      const content = getAttr(tag, "content");
      if (content) return decodeEntities(content).trim();
    }
  }
  return undefined;
}

function extractParagraphs(html: string, max = 1800): string | undefined {
  // Strip script/style first
  const cleaned = html.replace(SCRIPT_STYLE, " ");
  const paras: string[] = [];
  const re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) && paras.join(" ").length < max) {
    const txt = decodeEntities(m[1].replace(TAG, " ")).replace(WS, " ").trim();
    if (txt.length >= 40) paras.push(txt);
  }
  if (paras.length === 0) return undefined;
  let joined = paras.join("\n\n");
  if (joined.length > max) joined = joined.slice(0, max).replace(/\s+\S*$/, "") + "…";
  return joined;
}

export async function extractPreview(url: string): Promise<Extracted> {
  let host: string | undefined;
  try {
    host = new URL(url).host.replace(/^www\./, "");
  } catch {
    // invalid URL
  }

  let res: Response;
  try {
    res = await fetch(url, {
      redirect: "follow",
      headers: {
        // A realistic UA helps avoid bot pages from some publishers.
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 " +
          "(KHTML, like Gecko) Version/17.5 Safari/605.1.15",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
      // Don't cache forever; let Next.js revalidate periodically.
      next: { revalidate: 60 * 60 * 6 },
    });
  } catch {
    return { host };
  }
  if (!res.ok) return { host };

  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
    return { host };
  }

  let html = "";
  try {
    html = await res.text();
  } catch {
    return { host };
  }

  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const ogTitle = pickMeta(html, [
    { attr: "property", value: "og:title" },
    { attr: "name", value: "twitter:title" },
  ]);
  const title =
    ogTitle?.replace(WS, " ").trim() ||
    (titleTag ? decodeEntities(titleTag[1]).replace(WS, " ").trim() : undefined);

  const ogDesc = pickMeta(html, [
    { attr: "property", value: "og:description" },
    { attr: "name", value: "twitter:description" },
    { attr: "name", value: "description" },
  ]);

  // Pull a longer excerpt from body if we can; fall back to meta description.
  const body = extractParagraphs(html);
  const excerpt =
    body && body.length > 200 ? body : (body ?? ogDesc) || ogDesc;

  return { title, excerpt, host };
}
