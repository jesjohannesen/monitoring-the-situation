"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getSourceById } from "@/lib/feedCatalog";
import { FeedColumn } from "@/components/FeedColumn";
import { FeedPicker } from "@/components/FeedPicker";

const SELECTED_KEY = "briefing.feeds.selected";
const FAVORITES_KEY = "briefing.feeds.favorites";
// Users can subscribe to up to 10 feeds, but only 3 are shown side-by-side
// at any one time. The rest sit just off-screen — arrows in the header
// slide the visible window left/right.
const MAX_SELECTED = 10;
const VISIBLE_FEEDS = 3;

// Sensible defaults for a brand-new visitor — six flagship news + ideas
// outlets so the dashboard is well-stocked on first load and the user has
// a feel for the pager right away. Same six are auto-favorited.
const DEFAULT_SELECTED = [
  "wsj-world",
  "economist-latest",
  "ft-home",
  "the-atlantic",
  "aeon",
  "new-yorker",
];
const DEFAULT_FAVORITES = DEFAULT_SELECTED.slice();

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as unknown as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function LinksPage() {
  const [selected, setSelected] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Left edge of the visible window into `selected`. Clamped to
  // [0, max(0, selected.length - VISIBLE_FEEDS)].
  const [viewOffset, setViewOffset] = useState(0);
  // Last navigation direction — drives the slide animation. +1 = paged
  // right, -1 = paged left. Defaults to +1 so initial enter slides in
  // from the right side.
  const [navDir, setNavDir] = useState<1 | -1>(1);

  // Hydrate from localStorage on mount.
  useEffect(() => {
    const sel = readJSON<string[]>(SELECTED_KEY, DEFAULT_SELECTED);
    const fav = readJSON<string[]>(FAVORITES_KEY, DEFAULT_FAVORITES);
    setSelected(sel.slice(0, MAX_SELECTED));
    setFavorites(fav);
    setMounted(true);
  }, []);

  const persistSelected = useCallback((next: string[]) => {
    try {
      localStorage.setItem(SELECTED_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);
  const persistFavorites = useCallback((next: string[]) => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const toggleSelect = useCallback(
    (id: string) => {
      setSelected((prev) => {
        let next: string[];
        if (prev.includes(id)) {
          next = prev.filter((x) => x !== id);
        } else if (prev.length >= MAX_SELECTED) {
          return prev; // capped — picker disables further selects
        } else {
          next = [...prev, id];
        }
        persistSelected(next);
        return next;
      });
    },
    [persistSelected],
  );

  const toggleFavorite = useCallback(
    (id: string) => {
      setFavorites((prev) => {
        const next = prev.includes(id)
          ? prev.filter((x) => x !== id)
          : [...prev, id];
        persistFavorites(next);
        return next;
      });
    },
    [persistFavorites],
  );

  // If selected.length shrinks (removed a feed), keep viewOffset valid.
  useEffect(() => {
    const maxOffset = Math.max(0, selected.length - VISIBLE_FEEDS);
    if (viewOffset > maxOffset) setViewOffset(maxOffset);
  }, [selected.length, viewOffset]);

  // Drop any selected ids that no longer exist in the catalog, then take
  // a 3-element slice based on the current viewOffset.
  const { totalSources, visibleSources } = useMemo(() => {
    const all = selected
      .map((id) => getSourceById(id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));
    return {
      totalSources: all.length,
      visibleSources: all.slice(viewOffset, viewOffset + VISIBLE_FEEDS),
    };
  }, [selected, viewOffset]);

  const canPrev = viewOffset > 0;
  const canNext = viewOffset + VISIBLE_FEEDS < totalSources;

  // SSR/hydration safety: render an empty shell on the first paint.
  if (!mounted) {
    return (
      <Shell onAdd={() => {}} count={0}>
        {null}
      </Shell>
    );
  }

  return (
    <Shell
      onAdd={() => setPickerOpen(true)}
      count={totalSources}
      pager={
        totalSources > VISIBLE_FEEDS ? (
          <Pager
            offset={viewOffset}
            total={totalSources}
            visible={VISIBLE_FEEDS}
            canPrev={canPrev}
            canNext={canNext}
            onPrev={() => {
              setNavDir(-1);
              setViewOffset((o) => Math.max(0, o - 1));
            }}
            onNext={() => {
              setNavDir(1);
              setViewOffset((o) =>
                Math.min(totalSources - VISIBLE_FEEDS, o + 1),
              );
            }}
          />
        ) : null
      }
    >
      {totalSources === 0 ? (
        <EmptyState onPick={() => setPickerOpen(true)} />
      ) : (
        <div className="feeds-grid" data-count={visibleSources.length}>
          <AnimatePresence initial={false} mode="popLayout">
            {visibleSources.map((src) => (
              <motion.div
                key={src.id}
                layout
                initial={{ opacity: 0, x: navDir * 32 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -navDir * 32 }}
                transition={{
                  duration: 0.32,
                  ease: [0.2, 0.7, 0.2, 1],
                }}
                style={{ display: "flex", flexDirection: "column" }}
              >
                <FeedColumn
                  source={src}
                  onRemove={() => toggleSelect(src.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
      <FeedPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selected={selected}
        favorites={favorites}
        onToggleSelect={toggleSelect}
        onToggleFavorite={toggleFavorite}
        maxSelected={MAX_SELECTED}
      />
    </Shell>
  );
}

function Shell({
  children,
  onAdd,
  count,
  pager,
}: {
  children: React.ReactNode;
  onAdd: () => void;
  count: number;
  pager?: React.ReactNode;
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "72px 24px 28px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <h1
          className="glow-strong"
          style={{
            fontFamily: "var(--font-display), monospace",
            fontSize: "var(--heading-size)",
            lineHeight: "var(--heading-line-height)",
            letterSpacing: "var(--display-letter-spacing)",
            margin: 0,
          }}
        >
          news feeds
        </h1>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          {pager}
          <button
            type="button"
            onClick={onAdd}
            className="links-add-btn"
            style={{
              background: "transparent",
              border: "1px solid var(--border-med)",
              color: "var(--fg)",
              fontFamily: "var(--font-ui), monospace",
              fontSize: "12px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              padding: "6px 12px",
              cursor: "pointer",
              textShadow: "var(--glow-soft)",
              transition: "border-color 120ms ease-out",
            }}
          >
            [ {count}/{MAX_SELECTED} feeds — edit ]
          </button>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </main>
  );
}

function Pager({
  offset,
  total,
  visible,
  canPrev,
  canNext,
  onPrev,
  onNext,
}: {
  offset: number;
  total: number;
  visible: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const from = offset + 1;
  const to = Math.min(offset + visible, total);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        fontFamily: "var(--font-ui), monospace",
        fontSize: "12px",
        letterSpacing: "0.06em",
        textShadow: "var(--glow-soft)",
      }}
    >
      <PagerBtn onClick={onPrev} disabled={!canPrev} label="‹" />
      <span
        style={{
          opacity: 0.65,
          minWidth: "62px",
          textAlign: "center",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {from}–{to} of {total}
      </span>
      <PagerBtn onClick={onNext} disabled={!canNext} label="›" />
    </div>
  );
}

function PagerBtn({
  onClick,
  disabled,
  label,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="links-pager-btn"
      style={{
        background: "transparent",
        border: "1px solid var(--border-med)",
        color: "var(--fg)",
        fontFamily: "var(--font-ui), monospace",
        fontSize: "14px",
        lineHeight: 1,
        padding: "4px 10px 6px",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.3 : 1,
        textShadow: "var(--glow-soft)",
        transition: "border-color 120ms ease-out, opacity 120ms ease-out",
      }}
    >
      {label}
    </button>
  );
}

function EmptyState({ onPick }: { onPick: () => void }) {
  return (
    <div
      style={{
        border: "1px dashed var(--border-soft)",
        padding: "48px 24px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        fontFamily: "var(--font-ui), monospace",
      }}
    >
      <div style={{ opacity: 0.6, fontSize: "14px" }}>
        &gt; no feeds active
      </div>
      <div>
        <button
          type="button"
          onClick={onPick}
          style={{
            background: "transparent",
            border: "1px solid var(--border-med)",
            color: "var(--fg)",
            fontFamily: "var(--font-ui), monospace",
            fontSize: "12px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: "8px 14px",
            cursor: "pointer",
            textShadow: "var(--glow-soft)",
          }}
        >
          [ pick from catalog ]
        </button>
      </div>
    </div>
  );
}
