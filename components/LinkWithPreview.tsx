"use client";

import {
  AnchorHTMLAttributes,
  CSSProperties,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import type { LinkPreview } from "@/lib/supabase";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children?: ReactNode;
  seedPreviews?: Record<string, LinkPreview>;
};

type CardState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; data: LinkPreview }
  | { kind: "error"; message: string };

// In-memory cache shared across all links in the page.
const cache = new Map<string, Promise<LinkPreview>>();

async function fetchPreview(url: string): Promise<LinkPreview> {
  let p = cache.get(url);
  if (!p) {
    p = (async () => {
      const res = await fetch(
        `/api/link-preview?url=${encodeURIComponent(url)}`,
      );
      if (!res.ok) throw new Error(`status ${res.status}`);
      return (await res.json()) as LinkPreview;
    })();
    cache.set(url, p);
  }
  return p;
}

export function LinkWithPreview({
  href,
  children,
  seedPreviews,
  ...rest
}: Props) {
  const [state, setState] = useState<CardState>({ kind: "idle" });
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"above" | "below">("below");
  const linkRef = useRef<HTMLAnchorElement | null>(null);
  const cardRef = useRef<HTMLSpanElement | null>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);

  const url = typeof href === "string" ? href : "";

  // Seed the cache from the briefing payload (if the ingest included it).
  useEffect(() => {
    if (!url || !seedPreviews) return;
    const seed = seedPreviews[url];
    if (seed && (seed.title || seed.excerpt) && !cache.has(url)) {
      cache.set(url, Promise.resolve(seed));
    }
  }, [url, seedPreviews]);

  function clearTimers() {
    if (openTimer.current) window.clearTimeout(openTimer.current);
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  }

  function decidePlacement() {
    const el = linkRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    setPlacement(spaceBelow < 320 && rect.top > 320 ? "above" : "below");
  }

  function handleEnter() {
    if (!url) return;
    clearTimers();
    openTimer.current = window.setTimeout(() => {
      decidePlacement();
      setOpen(true);
      if (state.kind === "idle") {
        setState({ kind: "loading" });
        fetchPreview(url).then(
          (data) => setState({ kind: "ready", data }),
          (e) =>
            setState({
              kind: "error",
              message: e instanceof Error ? e.message : "unknown",
            }),
        );
      }
    }, 140);
  }

  function handleLeave() {
    clearTimers();
    closeTimer.current = window.setTimeout(() => setOpen(false), 160);
  }

  function handleCardEnter() {
    clearTimers();
  }

  function handleCardLeave() {
    handleLeave();
  }

  // Card uses <span> with display:block so it remains a valid descendant of
  // <p> (react-markdown wraps paragraphs in <p>, which disallows block-level
  // children).
  const cardStyle: CSSProperties = {
    display: "block",
    position: "absolute",
    zIndex: 70,
    [placement === "below" ? "top" : "bottom"]: "calc(100% + 6px)",
    left: 0,
    width: "min(420px, 80vw)",
    maxHeight: "280px",
    overflowY: "auto",
    background: "var(--bg)",
    color: "var(--fg)",
    border: "1px solid var(--border-soft)",
    padding: "14px 16px",
    fontFamily: "var(--font-jetbrains), monospace",
    fontSize: "13px",
    lineHeight: 1.55,
    textShadow: "var(--glow-soft)",
    boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
  };

  return (
    <span
      style={{ position: "relative", display: "inline" }}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <a
        ref={linkRef}
        href={url || "#"}
        target="_blank"
        rel="noopener noreferrer"
        {...rest}
      >
        {children}
      </a>
      {open && url && (
        <span
          ref={cardRef}
          style={cardStyle}
          onMouseEnter={handleCardEnter}
          onMouseLeave={handleCardLeave}
        >
          <PreviewBody state={state} url={url} />
        </span>
      )}
    </span>
  );
}

function PreviewBody({ state, url }: { state: CardState; url: string }) {
  const host = (() => {
    try {
      return new URL(url).host.replace(/^www\./, "");
    } catch {
      return undefined;
    }
  })();

  // All internal containers are <span> with display:block so the card stays
  // inline-valid (descendant of <p>).
  const block = (style: CSSProperties = {}): CSSProperties => ({
    display: "block",
    ...style,
  });

  if (state.kind === "loading") {
    return (
      <span style={block({ opacity: 0.8 })}>
        <span
          style={block({ opacity: 0.55, fontSize: "11px", marginBottom: "8px" })}
        >
          {host}
        </span>
        <span className="caret">&gt; loading preview</span>
      </span>
    );
  }
  if (state.kind === "error") {
    return (
      <span style={block({ opacity: 0.7 })}>
        <span
          style={block({ opacity: 0.55, fontSize: "11px", marginBottom: "8px" })}
        >
          {host}
        </span>
        &gt; preview unavailable
      </span>
    );
  }
  if (state.kind === "ready") {
    const { title, excerpt } = state.data;
    return (
      <span style={block()}>
        <span
          style={block({
            opacity: 0.55,
            fontSize: "11px",
            letterSpacing: "0.04em",
            marginBottom: "8px",
          })}
        >
          {state.data.host ?? host}
        </span>
        {title && (
          <span
            style={block({
              fontSize: "14px",
              marginBottom: "8px",
              fontWeight: 500,
            })}
          >
            {title}
          </span>
        )}
        {excerpt ? (
          <span style={block({ whiteSpace: "pre-wrap", opacity: 0.85 })}>
            {excerpt}
          </span>
        ) : (
          !title && (
            <span style={block({ opacity: 0.6 })}>
              &gt; no excerpt available
            </span>
          )
        )}
      </span>
    );
  }
  return null;
}
