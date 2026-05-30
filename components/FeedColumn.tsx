"use client";

import { useEffect, useState } from "react";
import type { Feed, FeedItem } from "@/lib/rss";
import type { FeedSource } from "@/lib/feedCatalog";

type Props = {
  source: FeedSource;
  onRemove: () => void;
};

export function FeedColumn({ source, onRemove }: Props) {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    fetch(`/api/feeds?id=${encodeURIComponent(source.id)}`, {
      cache: "force-cache",
    })
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
          throw new Error(j?.error || `HTTP ${r.status}`);
        }
        return r.json() as Promise<{ feed: Feed }>;
      })
      .then((j) => {
        if (!alive) return;
        setFeed(j.feed);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setErr(e instanceof Error ? e.message : "fetch failed");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [source.id]);

  return (
    <section
      style={{
        border: "1px solid var(--border-soft)",
        padding: "14px 16px 18px",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
        background: "var(--bg)",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: "10px",
          gap: "8px",
        }}
      >
        <a
          href={source.homepage || source.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "var(--fg)",
            textDecoration: "none",
            fontFamily: "var(--font-display), monospace",
            fontSize: "15px",
            letterSpacing: "0.03em",
            opacity: 0.78,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={source.url}
        >
          &gt; {source.name}
        </a>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`remove ${source.name}`}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--fg)",
            opacity: 0.45,
            cursor: "pointer",
            fontSize: "11px",
            fontFamily: "var(--font-ui), monospace",
            padding: 0,
            flexShrink: 0,
          }}
        >
          [ x ]
        </button>
      </header>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {loading && (
          <div style={{ opacity: 0.4, fontSize: "12px" }}>&gt; loading…</div>
        )}
        {err && (
          <div style={{ opacity: 0.6, fontSize: "12px" }}>
            &gt; error: {err}
          </div>
        )}
        {feed?.items.slice(0, 30).map((it, i) => (
          <FeedItemRow key={i} item={it} />
        ))}
        {feed && feed.items.length === 0 && !err && (
          <div style={{ opacity: 0.5, fontSize: "12px" }}>&gt; no items</div>
        )}
      </div>
    </section>
  );
}

/* ─── single item row, with optional thumbnail ────────────────────────── */

function FeedItemRow({ item }: { item: FeedItem }) {
  const [imgOk, setImgOk] = useState(true);
  const showImage = Boolean(item.thumbnail) && imgOk;
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        color: "var(--fg)",
        textDecoration: "none",
        fontFamily: "var(--font-body), monospace",
        fontSize: "13px",
        lineHeight: 1.45,
        borderBottom: "1px dashed var(--border-faint)",
        paddingBottom: "10px",
        display: "flex",
        gap: "10px",
        alignItems: "flex-start",
      }}
    >
      {showImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.thumbnail}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImgOk(false)}
          style={{
            width: "64px",
            height: "64px",
            objectFit: "cover",
            flexShrink: 0,
            border: "1px solid var(--border-soft)",
            background: "var(--border-faint)",
          }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500 }}>{item.title || "(untitled)"}</div>
        {(item.published_at || item.summary) && (
          <div
            style={{
              fontSize: "11px",
              opacity: 0.55,
              marginTop: "4px",
              display: "flex",
              flexDirection: "column",
              gap: "3px",
            }}
          >
            {item.published_at && <div>{formatDate(item.published_at)}</div>}
            {item.summary && (
              <div
                style={{
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: showImage ? 2 : 3,
                  WebkitBoxOrient: "vertical",
                }}
              >
                {item.summary}
              </div>
            )}
          </div>
        )}
      </div>
    </a>
  );
}

function formatDate(s: string): string {
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    const diffMs = Date.now() - d.getTime();
    const diffH = diffMs / 36e5;
    if (diffH < 1) return "just now";
    if (diffH < 24) return `${Math.floor(diffH)}h ago`;
    if (diffH < 24 * 7) return `${Math.floor(diffH / 24)}d ago`;
    return d.toLocaleDateString();
  } catch {
    return s;
  }
}
