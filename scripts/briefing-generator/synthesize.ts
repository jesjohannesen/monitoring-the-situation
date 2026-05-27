import type { RssItem } from "./rss";

export type BriefingFields = {
  themes_heading: string;
  synthesis_md: string;
  english_script: string;
  norwegian_script: string;
  sources: Array<{ title: string; url: string }>;
};

/**
 * synthesize: produces the four briefing fields from raw RSS items + the user
 * profile.
 *
 * This function is intentionally a stub. It is meant to be filled in at runtime
 * by the upstream LLM step — in this project's setup, that is a Claude Cowork
 * scheduled task that has access to the user's Claude subscription. The Cowork
 * run reads `items` and `userProfile`, drafts the four fields, and either:
 *
 *   (a) overwrites this file before running `generate.ts`, or
 *   (b) calls the exported `synthesize` symbol after monkey-patching it via a
 *       sibling file like `synthesize.local.ts`.
 *
 * The default implementation below produces a placeholder briefing so that the
 * pipeline end-to-end (RSS -> ingest -> webapp -> ElevenLabs) can be exercised
 * without an LLM in the loop.
 */
export async function synthesize(
  items: RssItem[],
  userProfile: string,
): Promise<BriefingFields> {
  void userProfile; // unused in the stub; LLM step uses it
  const top = items.slice(0, 5);
  const headlines = top
    .map((it) => `- ${it.source}: ${it.title}`)
    .join("\n");

  // Preserve case so acronyms (PHEIC, AI, NATO, etc.) read as acronyms.
  const themes_heading =
    top.length > 0
      ? top
          .slice(0, 3)
          .map((it) => it.title.split(/[—:|]/)[0].trim().slice(0, 32))
          .join(" · ")
      : "no items in window";

  const synthesis_md = [
    `Today's window pulled ${items.length} items from WSJ, The Economist, and Wired.`,
    ``,
    `Top of the stack:`,
    ``,
    headlines,
    ``,
    `## what this means for you`,
    ``,
    `This is the stub output. Replace \`synthesize.ts\` with a real implementation (or have the Cowork run overwrite it) to get a synthesized briefing that draws on the user profile.`,
  ].join("\n");

  const english_script = `Briefing stub. Today pulled ${items.length} items across the three sources. Replace the synthesize function to get a real spoken narration.`;
  const norwegian_script = `Stuff av brief. I dag kom det inn ${items.length} saker fra de tre kildene. Bytt ut synthesize-funksjonen for å få en ekte norsk fortellerversjon.`;

  const sources = top.map((it) => ({ title: it.title, url: it.link }));

  return {
    themes_heading,
    synthesis_md,
    english_script,
    norwegian_script,
    sources,
  };
}
