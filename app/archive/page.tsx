"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Summary = {
  id: string;
  briefing_date: string;
  themes_heading: string;
  tags: string[];
  ingested_at: string;
};

export default function ArchivePage() {
  const [briefings, setBriefings] = useState<Summary[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/briefings", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        const j = (await res.json()) as { briefings: Summary[] };
        setBriefings(j.briefings);
      })
      .catch((e) => setLoadErr(e instanceof Error ? e.message : "load failed"));
  }, []);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    (briefings ?? []).forEach((b) => b.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [briefings]);

  const filtered = useMemo(() => {
    if (!activeTag) return briefings ?? [];
    return (briefings ?? []).filter((b) => b.tags.includes(activeTag));
  }, [briefings, activeTag]);

  async function updateTags(date: string, tags: string[]) {
    const res = await fetch(`/api/briefings/${encodeURIComponent(date)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tags }),
    });
    if (!res.ok) throw new Error(`save failed: ${res.status}`);
    const json = (await res.json()) as { briefing: Summary };
    setBriefings((prev) =>
      (prev ?? []).map((b) =>
        b.briefing_date === date ? { ...b, tags: json.briefing.tags } : b,
      ),
    );
  }

  return (
    <main className="min-h-screen w-full flex justify-center px-6 py-16">
      <div className="w-full" style={{ maxWidth: "760px" }}>
        <h1
          className="glow-strong"
          style={{
            fontFamily: "var(--font-display), monospace",
            fontSize: "var(--heading-size)",
            lineHeight: "var(--heading-line-height)",
            letterSpacing: "var(--display-letter-spacing)",
            marginBottom: "20px",
          }}
        >
          previous summaries
        </h1>

        {loadErr && (
          <div
            style={{
              fontFamily: "var(--font-ui), monospace",
              fontSize: "13px",
              opacity: 0.6,
            }}
          >
            &gt; error: {loadErr}
          </div>
        )}

        {briefings && allTags.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "6px",
              marginBottom: "20px",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-display), monospace",
                fontSize: "16px",
                opacity: 0.6,
                marginRight: "4px",
              }}
            >
              &gt; filter:
            </span>
            <FilterPill
              label="all"
              active={activeTag === null}
              onClick={() => setActiveTag(null)}
            />
            {allTags.map((t) => (
              <FilterPill
                key={t}
                label={t}
                active={activeTag === t}
                onClick={() => setActiveTag(t === activeTag ? null : t)}
              />
            ))}
          </div>
        )}

        {briefings === null && !loadErr && (
          <div
            className="caret"
            style={{
              fontFamily: "var(--font-ui), monospace",
              fontSize: "13px",
              opacity: 0.6,
            }}
          >
            &gt; loading
          </div>
        )}

        {briefings && filtered.length === 0 && (
          <div
            style={{
              fontFamily: "var(--font-ui), monospace",
              fontSize: "13px",
              opacity: 0.55,
            }}
          >
            &gt; no entries{activeTag ? ` tagged "${activeTag}"` : ""}
          </div>
        )}

        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {filtered.map((b) => (
            <EntryRow
              key={b.id}
              briefing={b}
              onSaveTags={(tags) => updateTags(b.briefing_date, tags)}
            />
          ))}
        </ul>
      </div>
    </main>
  );
}

/* ─── filter pill ─────────────────────────────────────────────────────── */

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: active ? "var(--border-soft)" : "transparent",
        border: `1px solid ${active ? "var(--border-med)" : "var(--border-soft)"}`,
        color: "var(--fg)",
        fontFamily: "var(--font-ui), monospace",
        fontSize: "11px",
        letterSpacing: "0.06em",
        textTransform: "lowercase",
        padding: "4px 9px",
        cursor: "pointer",
        opacity: active ? 1 : 0.75,
        textShadow: "var(--glow-soft)",
        transition: "all 120ms ease-out",
      }}
    >
      {label}
    </button>
  );
}

/* ─── one row ─────────────────────────────────────────────────────────── */

function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const months = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  return `${days[dt.getUTCDay()]} ${months[dt.getUTCMonth()]} ${dt.getUTCDate()} ${dt.getUTCFullYear()}`;
}

function EntryRow({
  briefing,
  onSaveTags,
}: {
  briefing: Summary;
  onSaveTags: (tags: string[]) => Promise<void>;
}) {
  const [tags, setTags] = useState<string[]>(briefing.tags);
  const [adding, setAdding] = useState(false);
  const [input, setInput] = useState("");
  const [savingErr, setSavingErr] = useState<string | null>(null);

  useEffect(() => {
    setTags(briefing.tags);
  }, [briefing.tags]);

  async function commit(next: string[]) {
    setSavingErr(null);
    const prev = tags;
    setTags(next);
    try {
      await onSaveTags(next);
    } catch (e) {
      setTags(prev);
      setSavingErr(e instanceof Error ? e.message : "save failed");
    }
  }

  function addTag() {
    const t = input.trim().toLowerCase();
    if (!t) return;
    if (tags.includes(t)) {
      setInput("");
      setAdding(false);
      return;
    }
    commit([...tags, t]);
    setInput("");
    setAdding(false);
  }

  function removeTag(t: string) {
    commit(tags.filter((x) => x !== t));
  }

  return (
    <li
      style={{
        border: "1px solid var(--border-soft)",
        padding: "16px 18px",
        background: "transparent",
        transition: "border-color 120ms ease-out",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "8px",
        }}
      >
        <Link
          href={`/entry/${briefing.briefing_date}`}
          className="archive-entry-headline"
          style={{
            fontFamily: "var(--font-display), monospace",
            fontSize: "22px",
            color: "var(--fg)",
            textShadow: "var(--glow-strong)",
            textDecoration: "none",
            lineHeight: 1.25,
            flex: 1,
            overflowWrap: "anywhere",
          }}
        >
          {briefing.themes_heading}
        </Link>
        <span
          style={{
            fontFamily: "var(--font-ui), monospace",
            fontSize: "11px",
            opacity: 0.55,
            whiteSpace: "nowrap",
          }}
        >
          {formatDateLabel(briefing.briefing_date)}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px",
          alignItems: "center",
        }}
      >
        {tags.map((t) => (
          <span
            key={t}
            style={{
              border: "1px solid var(--border-soft)",
              padding: "2px 7px 2px 8px",
              fontFamily: "var(--font-ui), monospace",
              fontSize: "11px",
              letterSpacing: "0.04em",
              lineHeight: 1.5,
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {t}
            <button
              type="button"
              onClick={() => removeTag(t)}
              aria-label={`remove tag ${t}`}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--fg)",
                fontFamily: "var(--font-ui), monospace",
                fontSize: "10px",
                opacity: 0.5,
                padding: 0,
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </span>
        ))}
        {adding ? (
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onBlur={() => {
              if (input.trim()) addTag();
              else setAdding(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              } else if (e.key === "Escape") {
                setInput("");
                setAdding(false);
              }
            }}
            placeholder="tag…"
            style={{
              background: "transparent",
              border: "1px solid var(--border-med)",
              color: "var(--fg)",
              fontFamily: "var(--font-ui), monospace",
              fontSize: "11px",
              padding: "2px 7px",
              outline: "none",
              width: "90px",
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            style={{
              background: "transparent",
              border: "1px dashed var(--border-soft)",
              color: "var(--fg)",
              fontFamily: "var(--font-ui), monospace",
              fontSize: "11px",
              letterSpacing: "0.04em",
              padding: "2px 7px",
              cursor: "pointer",
              opacity: 0.6,
            }}
          >
            + tag
          </button>
        )}
        {savingErr && (
          <span
            style={{
              fontSize: "10px",
              opacity: 0.55,
              fontFamily: "var(--font-ui), monospace",
            }}
          >
            {savingErr}
          </span>
        )}
      </div>
    </li>
  );
}
