"use client";

import {
  CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Annotation } from "./AnnotatedSynthesis";

type Props = {
  briefingDate: string;
  annotations: Annotation[];
};

export function Reflections({ briefingDate, annotations }: Props) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<string>("");
  const [loaded, setLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [hasUnsaved, setHasUnsaved] = useState(false);

  // Fetch existing reflection on mount.
  useEffect(() => {
    let alive = true;
    fetch(
      `/api/reflections?briefing_date=${encodeURIComponent(briefingDate)}`,
      { cache: "no-store" },
    )
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        setContent(j?.reflection?.content ?? "");
        setLoaded(true);
      })
      .catch(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [briefingDate]);

  // Debounced auto-save: 1.2s after the last keystroke.
  useEffect(() => {
    if (!loaded || !hasUnsaved) return;
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/reflections", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ briefing_date: briefingDate, content }),
        });
        if (res.ok) {
          setSavedAt(new Date());
          setHasUnsaved(false);
        }
      } catch {
        /* will retry on next change */
      }
    }, 1200);
    return () => window.clearTimeout(t);
  }, [content, hasUnsaved, loaded, briefingDate]);

  const handleChange = useCallback((html: string) => {
    setContent(html);
    setHasUnsaved(true);
  }, []);

  return (
    <>
      <div style={{ marginTop: "12px" }}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="reflections-trigger"
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
          &gt; reflection [open]
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <ReflectionsWindow
            briefingDate={briefingDate}
            content={content}
            annotations={annotations}
            hasUnsaved={hasUnsaved}
            savedAt={savedAt}
            onChange={handleChange}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/* ─── modal ─────────────────────────────────────────────────────────── */

function ReflectionsWindow({
  briefingDate,
  content,
  annotations,
  hasUnsaved,
  savedAt,
  onChange,
  onClose,
}: {
  briefingDate: string;
  content: string;
  annotations: Annotation[];
  hasUnsaved: boolean;
  savedAt: Date | null;
  onChange: (html: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
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
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[55] flex items-center justify-center"
      onClick={onClose}
      style={{
        background: "var(--overlay-tint)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <motion.div
        initial={{ scale: 0.98, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.98, opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="reflection"
        style={{
          background: "var(--bg)",
          border: "1px solid var(--border-strong)",
          width: "min(1100px, 94vw)",
          height: "min(86vh, 820px)",
          display: "flex",
          flexDirection: "column",
          fontFamily: "var(--font-ui), monospace",
          color: "var(--fg)",
          boxShadow: "0 14px 50px rgba(0,0,0,0.6)",
        }}
      >
        {/* Title bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 16px",
            borderBottom: "1px solid var(--border-soft)",
            fontFamily: "var(--font-display), monospace",
            fontSize: "18px",
            letterSpacing: "0.04em",
            opacity: 0.85,
            textShadow: "var(--glow-soft)",
          }}
        >
          <span>
            [ reflection · {briefingDate} ]{" "}
            <SaveStatus hasUnsaved={hasUnsaved} savedAt={savedAt} />
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

        {/* Body: editor (flex 1) + notes column (fixed width) */}
        <div
          style={{
            flex: 1,
            display: "flex",
            minHeight: 0,
          }}
        >
          {/* Editor column */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
              borderRight: "1px solid var(--border-soft)",
            }}
          >
            <RichTextEditor content={content} onChange={onChange} />
          </div>

          {/* Notes column */}
          <div
            style={{
              width: "260px",
              flexShrink: 0,
              overflowY: "auto",
              padding: "14px 14px 18px",
              background: "var(--bg)",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-display), monospace",
                fontSize: "16px",
                opacity: 0.65,
                marginBottom: "10px",
              }}
            >
              &gt; notes ({annotations.length})
            </div>
            {annotations.length === 0 && (
              <div
                style={{
                  fontFamily: "var(--font-ui), monospace",
                  fontSize: "11px",
                  opacity: 0.5,
                }}
              >
                &gt; none yet — highlight text in the synthesis to add some
              </div>
            )}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              {annotations.map((a) => (
                <div
                  key={a.id}
                  style={{
                    border: "1px solid var(--border-soft)",
                    padding: "8px 10px",
                    fontFamily: "var(--font-body), monospace",
                    fontSize: "11px",
                    lineHeight: 1.5,
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                  }}
                >
                  <div
                    style={{
                      fontSize: "10px",
                      opacity: 0.55,
                      marginBottom: "5px",
                      letterSpacing: "0.04em",
                    }}
                  >
                    &gt; “
                    {a.selected_text.length > 60
                      ? a.selected_text.slice(0, 59) + "…"
                      : a.selected_text}
                    ”
                  </div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{a.note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SaveStatus({
  hasUnsaved,
  savedAt,
}: {
  hasUnsaved: boolean;
  savedAt: Date | null;
}) {
  if (hasUnsaved) {
    return (
      <span style={{ opacity: 0.55, fontSize: "13px", marginLeft: "8px" }}>
        — saving…
      </span>
    );
  }
  if (savedAt) {
    const t = `${String(savedAt.getHours()).padStart(2, "0")}:${String(
      savedAt.getMinutes(),
    ).padStart(2, "0")}`;
    return (
      <span style={{ opacity: 0.45, fontSize: "13px", marginLeft: "8px" }}>
        — saved {t}
      </span>
    );
  }
  return null;
}

/* ─── rich-text editor (contentEditable + execCommand toolbar) ───────── */

type Cmd =
  | { kind: "exec"; cmd: string; label: string; title: string; key?: string }
  | { kind: "block"; tag: string; label: string; title: string };

const COMMANDS: Cmd[] = [
  { kind: "exec", cmd: "bold", label: "B", title: "bold (⌘B)", key: "b" },
  { kind: "exec", cmd: "italic", label: "I", title: "italic (⌘I)", key: "i" },
  { kind: "block", tag: "h1", label: "H1", title: "heading 1" },
  { kind: "block", tag: "h2", label: "H2", title: "heading 2" },
  {
    kind: "exec",
    cmd: "insertUnorderedList",
    label: "• list",
    title: "bullet list",
  },
  {
    kind: "exec",
    cmd: "insertOrderedList",
    label: "1. list",
    title: "numbered list",
  },
];

function RichTextEditor({
  content,
  onChange,
}: {
  content: string;
  onChange: (html: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  // Set initial HTML once when the editor mounts. We do NOT re-set on every
  // content change — that would clobber the caret position while the user
  // is typing. The save round-trip echoes the same HTML we already have, so
  // we just trust the editor's DOM as the source of truth after mount.
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    if (!editorRef.current) return;
    editorRef.current.innerHTML = content;
    initialized.current = true;
  }, [content]);

  function exec(cmd: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, undefined);
    // Defer onChange to let execCommand finish its DOM update.
    requestAnimationFrame(() => {
      if (editorRef.current) onChange(editorRef.current.innerHTML);
    });
  }

  // Toggle the current block between the given tag and a plain <div>.
  // execCommand("formatBlock") is supported in all modern browsers and
  // accepts both bare ("h1") and bracketed ("<h1>") tag forms; the bracketed
  // form is the broadest-compat path.
  function execBlock(tag: string) {
    editorRef.current?.focus();
    const current = (
      document.queryCommandValue("formatBlock") || ""
    ).toLowerCase();
    const next = current === tag ? "div" : tag;
    document.execCommand("formatBlock", false, `<${next}>`);
    requestAnimationFrame(() => {
      if (editorRef.current) onChange(editorRef.current.innerHTML);
    });
  }

  function onInput() {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }

  // ⌘B / ⌘I shortcuts (browser native, but we still send onChange after).
  // Tab: indent the current list item if we're in a list, otherwise insert
  // four spaces. Shift+Tab: outdent.
  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && (e.key === "b" || e.key === "i")) {
      requestAnimationFrame(() => {
        if (editorRef.current) onChange(editorRef.current.innerHTML);
      });
      return;
    }
    // Auto-list triggers: typing `* `, `- `, or `1. ` at the start of an
    // otherwise-empty line converts the line into a bullet / numbered list.
    if (e.key === " " && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const sel = window.getSelection();
      if (sel && sel.isCollapsed && editorRef.current) {
        const range = sel.getRangeAt(0);
        // Walk up from the caret to find the enclosing "line" block.
        let block: Node | null = range.startContainer;
        let alreadyInList = false;
        while (block && block !== editorRef.current) {
          if (block.nodeType === 1) {
            const tag = (block as Element).tagName;
            if (tag === "LI" || tag === "UL" || tag === "OL") {
              alreadyInList = true;
              break;
            }
            if (tag === "DIV" || tag === "P") break;
          }
          block = block.parentNode;
        }
        if (!alreadyInList && block) {
          // Text from start of block to caret, and caret to end of block.
          const beforeRange = document.createRange();
          beforeRange.selectNodeContents(block);
          beforeRange.setEnd(range.startContainer, range.startOffset);
          const textBefore = beforeRange.toString();
          const afterRange = document.createRange();
          afterRange.setStart(range.startContainer, range.startOffset);
          afterRange.setEnd(block, block.childNodes.length);
          const textAfter = afterRange.toString();
          // Only trigger if the marker is the whole line so far.
          if (textAfter === "") {
            let listCmd: "insertUnorderedList" | "insertOrderedList" | null =
              null;
            let prefixLen = 0;
            if (/^[*-]$/.test(textBefore)) {
              listCmd = "insertUnorderedList";
              prefixLen = 1;
            } else if (/^\d+\.$/.test(textBefore)) {
              listCmd = "insertOrderedList";
              prefixLen = textBefore.length;
            }
            if (listCmd) {
              e.preventDefault();
              // Remove the marker text.
              for (let i = 0; i < prefixLen; i++) {
                document.execCommand("delete", false, undefined);
              }
              document.execCommand(listCmd, false, undefined);
              requestAnimationFrame(() => {
                if (editorRef.current) onChange(editorRef.current.innerHTML);
              });
              return;
            }
          }
        }
      }
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const sel = window.getSelection();
      const node = sel?.anchorNode;
      let inList = false;
      let cur: Node | null = node ?? null;
      while (cur && cur !== editorRef.current) {
        if (cur.nodeType === 1) {
          const tag = (cur as Element).tagName;
          if (tag === "LI" || tag === "UL" || tag === "OL") {
            inList = true;
            break;
          }
        }
        cur = cur.parentNode;
      }
      if (inList) {
        document.execCommand(e.shiftKey ? "outdent" : "indent", false, undefined);
      } else if (!e.shiftKey) {
        // Prose indent — four spaces. nbsp keeps them from collapsing.
        document.execCommand(
          "insertText",
          false,
          "    ",
        );
      }
      requestAnimationFrame(() => {
        if (editorRef.current) onChange(editorRef.current.innerHTML);
      });
    }
  }

  const toolbarBtnStyle: CSSProperties = {
    background: "transparent",
    border: "1px solid var(--border-soft)",
    color: "var(--fg)",
    fontFamily: "var(--font-ui), monospace",
    fontSize: "12px",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    padding: "6px 10px",
    cursor: "pointer",
    transition: "all 120ms ease-out",
    textShadow: "var(--glow-soft)",
  };

  return (
    <div
      style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
    >
      <div
        style={{
          display: "flex",
          gap: "6px",
          padding: "10px 14px",
          borderBottom: "1px solid var(--border-soft)",
          flexShrink: 0,
        }}
      >
        {COMMANDS.map((c) => (
          <button
            key={c.label}
            type="button"
            title={c.title}
            onMouseDown={(e) => {
              // Prevent the editor from losing focus before execCommand runs.
              e.preventDefault();
            }}
            onClick={() => (c.kind === "exec" ? exec(c.cmd) : execBlock(c.tag))}
            className="rt-btn"
            style={toolbarBtnStyle}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={onInput}
        onKeyDown={onKeyDown}
        spellCheck={false}
        data-placeholder="reflect on what you read…"
        className="reflection-editor"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "18px 22px",
          fontFamily: "var(--font-body), monospace",
          fontSize: "14px",
          lineHeight: 1.7,
          color: "var(--fg)",
          outline: "none",
          background: "transparent",
          textShadow: "var(--glow-soft)",
        }}
      />
    </div>
  );
}
