"use client";

import {
  AnchorHTMLAttributes,
  CSSProperties,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
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

type Anchor = {
  // Viewport-anchored coords for position: fixed.
  top: number;
  bottom: number;
  left: number;
  placement: "above" | "below";
};

export function LinkWithPreview({
  href,
  children,
  seedPreviews,
  ...rest
}: Props) {
  const [state, setState] = useState<CardState>({ kind: "idle" });
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [mounted, setMounted] = useState(false);
  const linkRef = useRef<HTMLAnchorElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);

  const url = typeof href === "string" ? href : "";

  // createPortal needs `document` — guard for SSR.
  useEffect(() => {
    setMounted(true);
  }, []);

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

  function computeAnchor(): Anchor | null {
    const el = linkRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const placement: "above" | "below" =
      spaceBelow < 320 && rect.top > 320 ? "above" : "below";
    return {
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      placement,
    };
  }

  function handleEnter() {
    if (!url) return;
    clearTimers();
    openTimer.current = window.setTimeout(() => {
      const a = computeAnchor();
      if (!a) return;
      setAnchor(a);
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

  // While the card is open, follow the link on scroll/resize so it stays
  // anchored to the underlying text.
  useEffect(() => {
    if (!open) return;
    function update() {
      const a = computeAnchor();
      if (a) setAnchor(a);
    }
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  // Build position: fixed style from the anchor.
  function cardPositionStyle(a: Anchor): CSSProperties {
    const cardWidth = Math.min(420, window.innerWidth * 0.8);
    // Keep the card on-screen horizontally.
    let left = a.left;
    const margin = 12;
    if (left + cardWidth > window.innerWidth - margin) {
      left = window.innerWidth - margin - cardWidth;
    }
    if (left < margin) left = margin;
    if (a.placement === "below") {
      return { top: a.bottom + 6, left };
    }
    return {
      top: a.top - 6,
      left,
      transform: "translateY(-100%)",
    };
  }

  const cardStyle: CSSProperties = anchor
    ? {
        ...cardPositionStyle(anchor),
        position: "fixed",
        zIndex: 95,
        width: "min(420px, 80vw)",
        maxHeight: "280px",
        overflowY: "auto",
        background: "var(--bg)",
        color: "var(--fg)",
        border: "1px solid var(--border-soft)",
        padding: "14px 16px",
        fontFamily: "var(--font-body), monospace",
        fontSize: "13px",
        lineHeight: 1.55,
        textShadow: "var(--glow-soft)",
        boxShadow: "0 6px 18px rgba(0,0,0,0.4)",
      }
    : {};

  return (
    <span
      style={{ display: "inline" }}
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
      {mounted && open && url && anchor &&
        createPortal(
          <div
            ref={cardRef}
            style={cardStyle}
            onMouseEnter={handleCardEnter}
            onMouseLeave={handleCardLeave}
          >
            <PreviewBody state={state} url={url} />
          </div>,
          document.body,
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
