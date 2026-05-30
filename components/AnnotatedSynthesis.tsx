"use client";

import {
  CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { LinkPreview } from "@/lib/supabase";
import { SynthesisBlock } from "./SynthesisBlock";
import { Reflections } from "./Reflections";
import { useDataStyle, type DataStyle } from "@/lib/useDataStyle";

export type Annotation = {
  id: string;
  briefing_date: string;
  selected_text: string;
  occurrence_index: number;
  note: string;
  created_at: string;
  updated_at: string;
};

type Props = {
  markdown: string;
  briefingDate: string;
  linkPreviews?: Record<string, LinkPreview>;
};

type PendingSelection = {
  text: string;
  occurrenceIndex: number;
  // viewport-anchored coords for the floating affordance
  x: number;
  y: number;
  // y relative to the container, used by the margin card
  topInContainer: number;
};

type EditorState =
  | { kind: "closed" }
  | { kind: "creating"; pending: PendingSelection }
  | { kind: "editing"; annotation: Annotation };

const FLOATING_FADE_AFTER_MS = 1000;

export function AnnotatedSynthesis({
  markdown,
  briefingDate,
  linkPreviews,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [pending, setPending] = useState<PendingSelection | null>(null);
  const [editor, setEditor] = useState<EditorState>({ kind: "closed" });
  const [notesOpen, setNotesOpen] = useState(false);
  // Per-card closed state. Click the [ x ] on a card to close it; click the
  // text highlight again to reopen. Persisted to localStorage per id.
  const [closed, setClosed] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const raw = localStorage.getItem("briefing.notes.closed");
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        if (Array.isArray(arr)) setClosed(new Set(arr));
      }
    } catch {
      /* ignore */
    }
  }, []);
  function setClosedState(next: Set<string>) {
    setClosed(next);
    try {
      localStorage.setItem(
        "briefing.notes.closed",
        JSON.stringify(Array.from(next)),
      );
    } catch {
      /* ignore */
    }
  }
  function closeCard(id: string) {
    const next = new Set(closed);
    next.add(id);
    setClosedState(next);
  }
  function openCard(id: string) {
    const next = new Set(closed);
    next.delete(id);
    setClosedState(next);
  }

  // Fetch annotations on mount / when briefing_date changes.
  useEffect(() => {
    let alive = true;
    fetch(
      `/api/annotations?briefing_date=${encodeURIComponent(briefingDate)}`,
      { cache: "no-store" },
    )
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (Array.isArray(j.annotations)) setAnnotations(j.annotations);
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      alive = false;
    };
  }, [briefingDate]);

  // Listen for selection inside the synthesis container; surface the floating
  // [ + note ] affordance.
  useEffect(() => {
    function onMouseUp() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setPending(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const root = containerRef.current;
      if (!root || !root.contains(range.commonAncestorContainer)) {
        setPending(null);
        return;
      }
      const text = sel.toString().trim();
      if (!text) {
        setPending(null);
        return;
      }
      // Occurrence index in the rendered text stream.
      const fullText = root.textContent ?? "";
      const startGlobal = computeRangeStart(root, range);
      let occurrenceIndex = 0;
      let from = 0;
      while (true) {
        const idx = fullText.indexOf(text, from);
        if (idx < 0 || idx >= startGlobal) break;
        occurrenceIndex += 1;
        from = idx + text.length;
      }
      const rect = range.getBoundingClientRect();
      const rootRect = root.getBoundingClientRect();
      setPending({
        text,
        occurrenceIndex,
        x: rect.right,
        y: rect.top - 6,
        topInContainer: rect.top - rootRect.top,
      });
    }

    document.addEventListener("mouseup", onMouseUp);
    return () => document.removeEventListener("mouseup", onMouseUp);
  }, []);

  // Apply highlights to the rendered synthesis once the markdown is in the DOM
  // and whenever annotations change. We also re-run on `closed` changes as a
  // safety net: React's reconciliation can wipe our DOM-mutated <mark>
  // elements when the parent re-renders, so we re-apply afterwards.
  useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    try {
      unhighlightAll(root);
    } catch (e) {
      console.warn("[annotation] unhighlight failed", e);
    }
    for (const ann of annotations) {
      highlightOccurrence(root, ann);
    }
  }, [annotations, markdown, closed]);

  // Click on a highlighted mark:
  //   - if the card is closed → reopen it (view mode)
  //   - otherwise → enter edit mode for that annotation
  // We preventDefault so a link inside the mark doesn't also navigate.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const mark = target.closest<HTMLElement>("mark.annotation-mark");
      if (!mark) return;
      const id = mark.dataset.annotationId;
      if (!id) return;
      const ann = annotations.find((a) => a.id === id);
      if (!ann) return;
      // Stop link-inside-mark navigation and any hovercard click bubbling.
      e.preventDefault();
      e.stopPropagation();
      if (closed.has(id)) {
        openCard(id);
        setEditor({ kind: "closed" });
      } else {
        setEditor({ kind: "editing", annotation: ann });
      }
    }
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotations, closed]);

  const openCreate = useCallback(() => {
    if (!pending) return;
    setEditor({ kind: "creating", pending });
    setPending(null);
  }, [pending]);

  async function saveCreate(text: string, occ: number, note: string) {
    const res = await fetch("/api/annotations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        briefing_date: briefingDate,
        selected_text: text,
        occurrence_index: occ,
        note,
      }),
    });
    if (!res.ok) throw new Error(`save failed: ${res.status}`);
    const json = (await res.json()) as { annotation: Annotation };
    setAnnotations((prev) => [...prev, json.annotation]);
    setEditor({ kind: "closed" });
    window.getSelection()?.removeAllRanges();
  }

  async function saveEdit(id: string, note: string) {
    const res = await fetch(`/api/annotations/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ note }),
    });
    if (!res.ok) throw new Error(`save failed: ${res.status}`);
    const json = (await res.json()) as { annotation: Annotation };
    setAnnotations((prev) =>
      prev.map((a) => (a.id === id ? json.annotation : a)),
    );
    setEditor({ kind: "closed" });
  }

  async function deleteAnnotation(id: string) {
    const res = await fetch(`/api/annotations/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`delete failed: ${res.status}`);
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    setEditor({ kind: "closed" });
  }

  return (
    <div>
      <div ref={containerRef} style={{ position: "relative" }}>
        <SynthesisBlock markdown={markdown} linkPreviews={linkPreviews} />
        <NotesMargin
          annotations={annotations}
          editor={editor}
          containerRef={containerRef}
          closed={closed}
          onClose={closeCard}
          onStartEdit={(a) => setEditor({ kind: "editing", annotation: a })}
          onCancel={() => setEditor({ kind: "closed" })}
          onSaveCreate={saveCreate}
          onSaveEdit={saveEdit}
          onDelete={deleteAnnotation}
        />
      </div>

      {pending && editor.kind === "closed" && (
        <FloatingAddNote
          pending={pending}
          onClick={openCreate}
          onTimeout={() => setPending(null)}
        />
      )}

      {/* Bottom list — collapsible roll-up of all notes, helpful overview */}
      <NotesList
        annotations={annotations}
        open={notesOpen}
        onToggle={() => setNotesOpen((v) => !v)}
        onOpen={(a) => {
          const root = containerRef.current;
          if (!root) return;
          const mark = root.querySelector<HTMLElement>(
            `mark.annotation-mark[data-annotation-id="${a.id}"]`,
          );
          if (mark) mark.scrollIntoView({ behavior: "smooth", block: "center" });
          setEditor({ kind: "editing", annotation: a });
        }}
        onDelete={deleteAnnotation}
      />

      {/* Reflection — opens a full-size editor with notes alongside */}
      <Reflections briefingDate={briefingDate} annotations={annotations} />
    </div>
  );
}

/* ─── floating "[ + note ]" affordance, with 2.5s fade-out ─────────────── */

function FloatingAddNote({
  pending,
  onClick,
  onTimeout,
}: {
  pending: PendingSelection;
  onClick: () => void;
  onTimeout: () => void;
}) {
  const [visible, setVisible] = useState(true);

  // Reset visibility whenever the pending selection changes.
  useEffect(() => {
    setVisible(true);
    const fadeAt = window.setTimeout(() => {
      setVisible(false);
    }, FLOATING_FADE_AFTER_MS);
    const removeAt = window.setTimeout(() => {
      onTimeout();
    }, FLOATING_FADE_AFTER_MS + 300);
    return () => {
      window.clearTimeout(fadeAt);
      window.clearTimeout(removeAt);
    };
  }, [pending, onTimeout]);

  const style: CSSProperties = {
    position: "fixed",
    top: Math.max(8, pending.y - 32),
    left: Math.max(8, pending.x - 80),
    zIndex: 80,
    fontFamily: "var(--font-ui), monospace",
    fontSize: "12px",
    letterSpacing: "0.06em",
    textTransform: "lowercase",
    padding: "6px 12px",
    background: "var(--bg)",
    border: "1px solid var(--border-strong)",
    color: "var(--fg)",
    cursor: "pointer",
    textShadow: "var(--glow-soft)",
    boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
    opacity: visible ? 1 : 0,
    transition: "opacity 280ms ease-out",
    pointerEvents: visible ? "auto" : "none",
  };
  return (
    <button
      type="button"
      // mousedown so the browser selection isn't cleared first.
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      style={style}
    >
      [ + note ]
    </button>
  );
}

/* ─── notes margin (right column of marginalia cards) ──────────────────── */

type MarginCard =
  | {
      kind: "annotation";
      id: string;
      annotation: Annotation;
      desiredTop: number;
    }
  | {
      kind: "pending";
      id: string;
      pending: PendingSelection;
      desiredTop: number;
    };

function NotesMargin({
  annotations,
  editor,
  containerRef,
  closed,
  onClose,
  onStartEdit,
  onCancel,
  onSaveCreate,
  onSaveEdit,
  onDelete,
}: {
  annotations: Annotation[];
  editor: EditorState;
  containerRef: React.RefObject<HTMLDivElement>;
  closed: Set<string>;
  onClose: (id: string) => void;
  onStartEdit: (a: Annotation) => void;
  onCancel: () => void;
  onSaveCreate: (text: string, occ: number, note: string) => Promise<void>;
  onSaveEdit: (id: string, note: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const marginRef = useRef<HTMLDivElement | null>(null);
  // Final laid-out tops keyed by card id.
  const [layout, setLayout] = useState<Record<string, number>>({});
  // Measured heights keyed by card id (populated after render).
  const heightsRef = useRef<Record<string, number>>({});

  const recomputeLayout = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;
    const rootRect = root.getBoundingClientRect();

    const cards: MarginCard[] = [];
    for (const ann of annotations) {
      if (closed.has(ann.id)) continue;
      const mark = root.querySelector<HTMLElement>(
        `mark.annotation-mark[data-annotation-id="${ann.id}"]`,
      );
      if (!mark) continue;
      const desiredTop = mark.getBoundingClientRect().top - rootRect.top;
      cards.push({ kind: "annotation", id: ann.id, annotation: ann, desiredTop });
    }
    if (editor.kind === "creating") {
      cards.push({
        kind: "pending",
        id: "__pending__",
        pending: editor.pending,
        desiredTop: editor.pending.topInContainer,
      });
    }
    cards.sort((a, b) => a.desiredTop - b.desiredTop);

    const GAP = 12;
    const FALLBACK_H = 96;
    const next: Record<string, number> = {};
    let lastBottom = -Infinity;
    for (const c of cards) {
      const h = heightsRef.current[c.id] ?? FALLBACK_H;
      const top = Math.max(c.desiredTop, lastBottom + GAP);
      next[c.id] = top;
      lastBottom = top + h;
    }
    setLayout(next);
  }, [annotations, editor, containerRef, closed]);

  // Recompute on annotations / editor change.
  useLayoutEffect(() => {
    recomputeLayout();
  }, [recomputeLayout]);

  // Recompute on container size change.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const ro = new ResizeObserver(() => recomputeLayout());
    ro.observe(root);
    window.addEventListener("resize", recomputeLayout);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recomputeLayout);
    };
  }, [containerRef, recomputeLayout]);

  function onCardMeasured(id: string, h: number) {
    const prev = heightsRef.current[id];
    if (prev === h) return;
    heightsRef.current[id] = h;
    recomputeLayout();
  }

  return (
    <div
      ref={marginRef}
      className="notes-margin"
      style={{
        position: "absolute",
        top: 0,
        left: "calc(100% + 28px)",
        width: "240px",
        // Children re-enable pointer events; gives parent click-through.
        pointerEvents: "none",
      }}
    >
      {annotations.map((a) => {
        if (closed.has(a.id)) return null;
        const isEditing =
          editor.kind === "editing" && editor.annotation.id === a.id;
        const top = layout[a.id];
        if (top === undefined) return null;
        return (
          <MarginPositioned
            key={a.id}
            id={a.id}
            top={top}
            onMeasured={onCardMeasured}
          >
            {isEditing ? (
              <NoteCard
                mode="edit"
                snippet={a.selected_text}
                initialNote={a.note}
                onSave={(note) => onSaveEdit(a.id, note)}
                onCancel={onCancel}
                onDelete={() => onDelete(a.id)}
                onClose={() => onClose(a.id)}
              />
            ) : (
              <NoteCard
                mode="view"
                snippet={a.selected_text}
                initialNote={a.note}
                onActivate={() => onStartEdit(a)}
                onClose={() => onClose(a.id)}
              />
            )}
          </MarginPositioned>
        );
      })}
      {editor.kind === "creating" && (
        <MarginPositioned
          id="__pending__"
          top={layout["__pending__"] ?? editor.pending.topInContainer}
          onMeasured={onCardMeasured}
        >
          <NoteCard
            mode="edit"
            snippet={editor.pending.text}
            initialNote=""
            onSave={(note) =>
              onSaveCreate(
                editor.pending.text,
                editor.pending.occurrenceIndex,
                note,
              )
            }
            onCancel={onCancel}
          />
        </MarginPositioned>
      )}
    </div>
  );
}

function MarginPositioned({
  id,
  top,
  onMeasured,
  children,
}: {
  id: string;
  top: number;
  onMeasured: (id: string, h: number) => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height ?? 0;
      onMeasured(id, h);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [id, onMeasured]);
  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top,
        left: 0,
        width: "100%",
        pointerEvents: "auto",
        transition: "top 160ms ease-out",
      }}
    >
      {children}
    </div>
  );
}

/* ─── single note card (view + edit modes) ─────────────────────────────── */

function NoteCard({
  mode,
  snippet,
  initialNote,
  onActivate,
  onSave,
  onCancel,
  onDelete,
  onClose,
}: {
  mode: "view" | "edit";
  snippet: string;
  initialNote: string;
  onActivate?: () => void;
  onSave?: (note: string) => Promise<void>;
  onCancel?: () => void;
  onDelete?: () => Promise<void>;
  onClose?: () => void;
}) {
  const [value, setValue] = useState(initialNote);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const dataStyle = useDataStyle();

  useEffect(() => {
    if (mode === "edit") taRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    if (mode !== "edit") return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel?.();
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void handleSave();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, value]);

  async function handleSave() {
    if (saving || !onSave) return;
    setSaving(true);
    setErr(null);
    try {
      await onSave(value);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    setSaving(true);
    setErr(null);
    try {
      await onDelete();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "delete failed");
      setSaving(false);
    }
  }

  const containerStyle: CSSProperties = {
    background: "var(--bg)",
    border:
      mode === "edit"
        ? "1px solid var(--border-strong)"
        : "1px solid var(--border-soft)",
    padding: "10px 12px",
    // Reserve space on the right so the snippet ellipsis never butts up
    // against the close button.
    paddingRight: onClose ? "40px" : "12px",
    fontFamily: "var(--font-body), monospace",
    fontSize: "12px",
    lineHeight: 1.55,
    color: "var(--fg)",
    cursor: mode === "view" ? "pointer" : "default",
    boxShadow: mode === "edit" ? "0 6px 16px rgba(0,0,0,0.4)" : "none",
    position: "relative",
  };

  const closeBtn = onClose ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onMouseDown={(e) => e.stopPropagation()}
      title="close — click the highlight to bring it back"
      aria-label="close note"
      className="note-min-btn"
      style={{
        position: "absolute",
        top: "4px",
        right: "4px",
        background: "transparent",
        border: "none",
        color: "var(--fg)",
        fontFamily: "var(--font-ui), monospace",
        fontSize: "11px",
        lineHeight: 1,
        padding: "4px 6px",
        cursor: "pointer",
        opacity: 0.45,
        transition: "opacity 120ms ease-out",
      }}
    >
      [ x ]
    </button>
  ) : null;

  if (mode === "view") {
    return (
      <div
        style={{ ...containerStyle, overflowWrap: "anywhere", wordBreak: "break-word" }}
        onClick={onActivate}
        className="note-card-view"
      >
        {closeBtn}
        <div
          style={{
            fontSize: "10px",
            opacity: 0.55,
            marginBottom: "6px",
            letterSpacing: "0.04em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "100%",
          }}
          title={snippet}
        >
          &gt; “{snippet.length > 36 ? snippet.slice(0, 35) + "…" : snippet}”
        </div>
        <div
          style={{
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            wordBreak: "break-word",
          }}
        >
          {initialNote}
        </div>
        <style jsx>{`
          .note-card-view:hover {
            border-color: var(--border-med) !important;
          }
          .note-card-view:hover :global(.note-min-btn) {
            opacity: 0.9;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={containerStyle} onMouseDown={(e) => e.stopPropagation()}>
      {closeBtn}
      <div
        style={{
          fontSize: "10px",
          opacity: 0.55,
          marginBottom: "6px",
          letterSpacing: "0.04em",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
        title={snippet}
      >
        &gt; “{snippet.length > 36 ? snippet.slice(0, 35) + "…" : snippet}”
      </div>
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="thought, idea, follow-up…"
        rows={4}
        style={{
          width: "100%",
          background: "transparent",
          border: "1px solid var(--border-soft)",
          color: "var(--fg)",
          fontFamily: "var(--font-body), monospace",
          fontSize: "12px",
          lineHeight: 1.5,
          padding: "6px 8px",
          resize: "vertical",
          outline: "none",
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "6px",
          marginTop: "8px",
        }}
      >
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !value.trim()}
            className="ann-btn"
            style={annBtnStyle({
              disabled: saving || !value.trim(),
              style: dataStyle,
            })}
          >
            {bracketLabel("save", dataStyle)}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="ann-btn"
            style={annBtnStyle({ style: dataStyle })}
          >
            {bracketLabel("cancel", dataStyle)}
          </button>
        </div>
        {onDelete && (
          <button
            type="button"
            onClick={handleDelete}
            className="ann-btn"
            style={annBtnStyle({ subtle: true, style: dataStyle })}
          >
            {bracketLabel("delete", dataStyle)}
          </button>
        )}
      </div>
      {err && (
        <div style={{ marginTop: "6px", fontSize: "10px", opacity: 0.6 }}>
          {err}
        </div>
      )}
      <style jsx>{`
        .ann-btn:hover:not(:disabled) {
          border-color: var(--fg) !important;
          text-shadow: var(--glow-strong);
        }
      `}</style>
    </div>
  );
}


// Hacker keeps the terminal `[ TEXT ]` look. Cognition + paul-allen drop the
// brackets — they read as visual noise against Inter / Copperplate.
function bracketLabel(text: string, style: DataStyle): string {
  return style === "hacker" ? `[ ${text} ]` : text;
}

function annBtnStyle({
  disabled,
  subtle,
  style,
}: {
  disabled?: boolean;
  subtle?: boolean;
  style: DataStyle;
}): CSSProperties {
  const isTerminal = style === "hacker";
  return {
    background: "transparent",
    border: `1px solid ${subtle ? "var(--border-soft)" : "var(--border-strong)"}`,
    color: "var(--fg)",
    fontFamily: "var(--font-ui), monospace",
    // Slightly smaller / tighter for editorial themes; the terminal theme
    // benefits from the wider tracking and the bracketed label.
    fontSize: isTerminal ? "10px" : "9px",
    letterSpacing: isTerminal ? "0.08em" : "0.05em",
    textTransform: "uppercase",
    padding: isTerminal ? "5px 8px" : "4px 9px",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
    transition: "all 120ms ease-out",
    textShadow: "var(--glow-soft)",
  };
}

/* ─── notes list (bottom rollup) ───────────────────────────────────────── */

function NotesList({
  annotations,
  open,
  onToggle,
  onOpen,
  onDelete,
}: {
  annotations: Annotation[];
  open: boolean;
  onToggle: () => void;
  onOpen: (a: Annotation) => void;
  onDelete: (id: string) => void;
}) {
  if (annotations.length === 0) return null;
  return (
    <div style={{ marginTop: "20px" }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--fg)",
          fontFamily: "var(--font-display), monospace",
          fontSize: "var(--toggle-size)",
          letterSpacing: "0.03em",
          opacity: 0.7,
          textTransform: "lowercase",
          cursor: "pointer",
          padding: "6px 0",
          textShadow: "var(--glow-strong)",
        }}
      >
        &gt; notes ({annotations.length}) [{open ? "−" : "+"}]
      </button>
      {open && (
        <ul
          style={{
            listStyle: "none",
            padding: "8px 0 0",
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {annotations.map((a) => (
            <li
              key={a.id}
              style={{
                border: "1px solid var(--border-soft)",
                padding: "10px 12px",
                fontFamily: "var(--font-body), monospace",
                fontSize: "13px",
                lineHeight: 1.5,
                overflowWrap: "anywhere",
                wordBreak: "break-word",
              }}
            >
              <button
                type="button"
                onClick={() => onOpen(a)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--fg)",
                  fontFamily: "inherit",
                  fontSize: "11px",
                  letterSpacing: "0.04em",
                  opacity: 0.55,
                  padding: 0,
                  cursor: "pointer",
                  display: "block",
                  marginBottom: "6px",
                  textAlign: "left",
                }}
              >
                &gt; “
                {a.selected_text.length > 80
                  ? a.selected_text.slice(0, 79) + "…"
                  : a.selected_text}
                ”
              </button>
              <div
                style={{
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                }}
              >
                {a.note}
              </div>
              <div style={{ marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => onDelete(a.id)}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--border-soft)",
                    color: "var(--fg)",
                    fontFamily: "inherit",
                    fontSize: "10px",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    padding: "4px 8px",
                    cursor: "pointer",
                    opacity: 0.7,
                  }}
                >
                  [ delete ]
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ─── highlight + DOM helpers ──────────────────────────────────────────── */

function computeRangeStart(root: HTMLElement, range: Range): number {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let pos = 0;
  let n: Node | null;
  while ((n = walker.nextNode())) {
    if (n === range.startContainer) return pos + range.startOffset;
    pos += (n.nodeValue ?? "").length;
  }
  return pos;
}

function findRangeForNthOccurrence(
  root: HTMLElement,
  needle: string,
  occurrenceIndex: number,
): Range | null {
  type Seg = { node: Text; start: number; end: number };
  const segments: Seg[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      let parent: Node | null = node.parentNode;
      while (parent && parent !== root) {
        if (
          parent.nodeType === 1 &&
          (parent as Element).classList?.contains("annotation-mark")
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        parent = parent.parentNode;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let pos = 0;
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const t = n as Text;
    segments.push({ node: t, start: pos, end: pos + t.data.length });
    pos += t.data.length;
  }
  const fullText = segments.map((s) => s.node.data).join("");

  let foundAt = -1;
  let searchFrom = 0;
  for (let i = 0; i <= occurrenceIndex; i++) {
    foundAt = fullText.indexOf(needle, searchFrom);
    if (foundAt < 0) return null;
    searchFrom = foundAt + needle.length;
  }
  const startGlobal = foundAt;
  const endGlobal = foundAt + needle.length;

  function findLocal(global: number): { node: Text; offset: number } | null {
    for (const s of segments) {
      if (global >= s.start && global <= s.end) {
        return { node: s.node, offset: global - s.start };
      }
    }
    return null;
  }
  const startLoc = findLocal(startGlobal);
  const endLoc = findLocal(endGlobal);
  if (!startLoc || !endLoc) return null;

  const range = document.createRange();
  try {
    range.setStart(startLoc.node, startLoc.offset);
    range.setEnd(endLoc.node, endLoc.offset);
  } catch {
    return null;
  }
  return range;
}

function highlightOccurrence(root: HTMLElement, ann: Annotation): boolean {
  const range = findRangeForNthOccurrence(
    root,
    ann.selected_text,
    ann.occurrence_index,
  );
  if (!range) return false;
  try {
    const fragment = range.extractContents();
    const mark = document.createElement("mark");
    mark.className = "annotation-mark";
    mark.dataset.annotationId = ann.id;
    mark.appendChild(fragment);
    range.insertNode(mark);
    (mark.parentNode as HTMLElement | null)?.normalize?.();
    return true;
  } catch (e) {
    console.warn("[annotation] highlight failed", e);
    return false;
  }
}

function unhighlightAll(root: HTMLElement) {
  const marks = Array.from(root.querySelectorAll("mark.annotation-mark"));
  for (const m of marks) {
    try {
      const parent = m.parentNode;
      if (!parent) continue;
      while (m.firstChild) parent.insertBefore(m.firstChild, m);
      parent.removeChild(m);
      (parent as HTMLElement).normalize?.();
    } catch (e) {
      console.warn("[annotation] unwrap failed", e);
    }
  }
}
