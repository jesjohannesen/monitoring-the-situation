"use client";

import { memo } from "react";
import ReactMarkdown, { Components } from "react-markdown";
import type { LinkPreview } from "@/lib/supabase";
import { LinkWithPreview } from "./LinkWithPreview";
import { PierceAndPierceMark } from "./PierceAndPierceMark";

type Props = {
  markdown: string;
  linkPreviews?: Record<string, LinkPreview>;
};

function SynthesisBlockImpl({ markdown, linkPreviews }: Props) {
  const components: Components = {
    a: ({ href, children, ...rest }) => (
      <LinkWithPreview
        href={href}
        seedPreviews={linkPreviews}
        {...(rest as Record<string, unknown>)}
      >
        {children}
      </LinkWithPreview>
    ),
  };

  return (
    <div style={{ position: "relative" }}>
      <PierceAndPierceMark />
      <div
        className="prose-terminal glow-soft"
        style={{
          border: "1px solid var(--border-soft)",
          padding: "24px 24px 22px",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          fontFamily: "var(--font-body), monospace",
          fontSize: "var(--prose-font-size)",
          lineHeight: "var(--prose-line-height)",
        }}
      >
        <ReactMarkdown components={components}>{markdown}</ReactMarkdown>
      </div>
    </div>
  );
}

// Memoized so the markdown only re-renders when its actual props change —
// closing a margin card doesn't reconcile (and thus doesn't wipe) the inline
// <mark> nodes the annotation system inserts.
export const SynthesisBlock = memo(SynthesisBlockImpl);

