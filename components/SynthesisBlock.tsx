"use client";

import ReactMarkdown, { Components } from "react-markdown";
import type { LinkPreview } from "@/lib/supabase";
import { LinkWithPreview } from "./LinkWithPreview";

type Props = {
  markdown: string;
  linkPreviews?: Record<string, LinkPreview>;
};

export function SynthesisBlock({ markdown, linkPreviews }: Props) {
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
    <div
      className="prose-terminal glow-soft"
      style={{
        border: "1px solid var(--border-soft)",
        padding: "24px",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        fontFamily: "var(--font-jetbrains), monospace",
        fontSize: "15px",
        lineHeight: 1.7,
      }}
    >
      <ReactMarkdown components={components}>{markdown}</ReactMarkdown>
    </div>
  );
}
