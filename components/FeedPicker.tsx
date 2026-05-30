"use client";

import { useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CATALOG, getSourceById, type FeedSource } from "@/lib/feedCatalog";

type Props = {
  open: boolean;
  onClose: () => void;
  selected: string[];
  favorites: string[];
  onToggleSelect: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  maxSelected: number;
};

export function FeedPicker({
  open,
  onClose,
  selected,
  favorites,
  onToggleSelect,
  onToggleFavorite,
  maxSelected,
}: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // Build a virtual "favorites" category at the top of the catalog. We
  // de-dupe so a favorited source isn't shown twice — the favorites pane
  // is just a fast-access surface, the same row in its real category still
  // exists below.
  const favoriteSources = useMemo<FeedSource[]>(
    () =>
      favorites
        .map((id) => getSourceById(id))
        .filter((s): s is FeedSource => Boolean(s)),
    [favorites],
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-[70] flex items-center justify-center"
          style={{
            background: "var(--overlay-tint)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            padding: "24px",
          }}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.98, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            role="dialog"
            aria-modal="true"
            aria-label="choose feeds"
            style={{
              background: "var(--bg)",
              border: "1px solid var(--border-strong)",
              width: "min(820px, 96vw)",
              height: "min(86vh, 720px)",
              display: "flex",
              flexDirection: "column",
              fontFamily: "var(--font-ui), monospace",
              color: "var(--fg)",
              boxShadow: "0 14px 50px rgba(0,0,0,0.5)",
            }}
          >
            {/* Title bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 18px",
                borderBottom: "1px solid var(--border-soft)",
                fontFamily: "var(--font-display), monospace",
                fontSize: "18px",
                letterSpacing: "0.03em",
                opacity: 0.9,
                textShadow: "var(--glow-soft)",
              }}
            >
              <span>
                [ feeds · {selected.length}/{maxSelected} active ]
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="close"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--fg)",
                  fontFamily: "var(--font-display), monospace",
                  fontSize: "18px",
                  cursor: "pointer",
                  padding: "0 4px",
                  opacity: 0.75,
                }}
              >
                [ x ]
              </button>
            </div>

            {/* Body */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                padding: "14px 18px 22px",
              }}
            >
              {favoriteSources.length > 0 && (
                <Section
                  label="favorites"
                  sources={favoriteSources}
                  selected={selected}
                  favorites={favorites}
                  onToggleSelect={onToggleSelect}
                  onToggleFavorite={onToggleFavorite}
                  maxSelected={maxSelected}
                />
              )}
              {CATALOG.map((cat) => (
                <Section
                  key={cat.id}
                  label={cat.label}
                  sources={cat.sources}
                  selected={selected}
                  favorites={favorites}
                  onToggleSelect={onToggleSelect}
                  onToggleFavorite={onToggleFavorite}
                  maxSelected={maxSelected}
                />
              ))}
            </div>
            <div
              style={{
                borderTop: "1px solid var(--border-soft)",
                padding: "8px 18px",
                fontSize: "11px",
                opacity: 0.5,
              }}
            >
              &gt; up to {maxSelected} active feeds — star to favorite for
              quick access
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Section({
  label,
  sources,
  selected,
  favorites,
  onToggleSelect,
  onToggleFavorite,
  maxSelected,
}: {
  label: string;
  sources: FeedSource[];
  selected: string[];
  favorites: string[];
  onToggleSelect: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  maxSelected: number;
}) {
  return (
    <div style={{ marginBottom: "18px" }}>
      <div
        style={{
          fontFamily: "var(--font-display), monospace",
          fontSize: "13px",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          opacity: 0.5,
          marginBottom: "6px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
        }}
      >
        {sources.map((src) => {
          const isSelected = selected.includes(src.id);
          const isFav = favorites.includes(src.id);
          const isCapped = !isSelected && selected.length >= maxSelected;
          return (
            <div
              key={src.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "6px 4px",
                borderBottom: "1px solid var(--border-faint)",
                opacity: isCapped ? 0.5 : 1,
              }}
            >
              <button
                type="button"
                onClick={() => !isCapped && onToggleSelect(src.id)}
                disabled={isCapped}
                aria-pressed={isSelected}
                title={isCapped ? "max active feeds reached" : "toggle in dashboard"}
                style={{
                  border: "1px solid var(--border-med)",
                  cursor: isCapped ? "not-allowed" : "pointer",
                  fontFamily: "var(--font-ui), monospace",
                  fontSize: "10px",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  padding: "3px 8px",
                  minWidth: "62px",
                  textAlign: "center",
                  background: isSelected ? "var(--fg)" : "transparent",
                  color: isSelected ? "var(--bg)" : "var(--fg)",
                }}
              >
                {isSelected ? "active" : "add"}
              </button>
              <button
                type="button"
                onClick={() => onToggleFavorite(src.id)}
                aria-pressed={isFav}
                title={isFav ? "unfavorite" : "favorite"}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--fg)",
                  cursor: "pointer",
                  fontSize: "16px",
                  padding: "2px 4px",
                  opacity: isFav ? 1 : 0.35,
                  lineHeight: 1,
                }}
              >
                {isFav ? "★" : "☆"}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: "var(--font-body), monospace",
                    fontSize: "13px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {src.name}
                </div>
                {src.blurb && (
                  <div
                    style={{
                      fontSize: "11px",
                      opacity: 0.55,
                      marginTop: "1px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {src.blurb}
                  </div>
                )}
              </div>
              {src.homepage && (
                <a
                  href={src.homepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "var(--fg)",
                    opacity: 0.4,
                    fontSize: "11px",
                    textDecoration: "none",
                    padding: "2px 4px",
                    flexShrink: 0,
                  }}
                  title={src.homepage}
                >
                  ↗
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
