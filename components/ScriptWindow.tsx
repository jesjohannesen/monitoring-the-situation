"use client";

import { ReactNode, useEffect } from "react";
import { motion } from "framer-motion";

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function ScriptWindow({ title, onClose, children }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    // Disable body scroll while window is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
      style={{
        background: "var(--overlay-tint)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <motion.div
        initial={{ scale: 0.98, y: 6 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.98 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          background: "var(--bg)",
          border: "1px solid var(--border-strong)",
          width: "min(640px, 92vw)",
          maxHeight: "82vh",
          display: "flex",
          flexDirection: "column",
          fontFamily: "var(--font-jetbrains), monospace",
          color: "var(--fg)",
          boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
        }}
      >
        {/* Title bar — terminal "window chrome" */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            borderBottom: "1px solid var(--border-soft)",
            fontFamily: "var(--font-vt323), monospace",
            fontSize: "18px",
            letterSpacing: "0.04em",
            opacity: 0.85,
            textShadow: "var(--glow-soft)",
            lineHeight: 1,
          }}
        >
          <span>[ {title} ]</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            className="script-window-close"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--fg)",
              fontFamily: "var(--font-vt323), monospace",
              fontSize: "18px",
              cursor: "pointer",
              padding: "0 4px",
              lineHeight: 1,
              opacity: 0.7,
              transition: "opacity 120ms ease-out, text-shadow 120ms ease-out",
            }}
          >
            [ x ]
          </button>
        </div>
        {/* Body */}
        <div
          style={{
            padding: "18px 20px",
            overflowY: "auto",
            fontSize: "15px",
            lineHeight: 1.7,
            textShadow: "var(--glow-soft)",
          }}
        >
          {children}
        </div>
        <style jsx>{`
          .script-window-close:hover {
            opacity: 1 !important;
            text-shadow: var(--glow-strong);
          }
        `}</style>
      </motion.div>
    </motion.div>
  );
}
