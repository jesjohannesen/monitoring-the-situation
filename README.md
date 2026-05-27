# briefing

A hyperminimalist daily news briefing webapp. Black-and-white only, terminal
feel. The app does **not** call the Anthropic API. A separate upstream job
(e.g. a Claude Cowork scheduled task running on your own machine) generates the
briefing and POSTs it here; this app just displays it and proxies audio to
ElevenLabs.

## Stack

- Next.js 14 App Router + TypeScript
- Tailwind CSS
- framer-motion (boot-screen whoosh)
- Supabase (Postgres) — server-side service-role only
- ElevenLabs TTS (English: `eleven_multilingual_v2`; Norwegian: `eleven_turbo_v2_5` with `language_code: "no"`)
- Vercel as the deploy target

## Setup

```bash
npm install
cp .env.example .env.local
# fill in the env values, then:
npm run dev
```

### Required env vars

| Var                            | Where it's used                                     |
|--------------------------------|-----------------------------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`     | Supabase project URL                                |
| `SUPABASE_SERVICE_ROLE_KEY`    | Server-side DB access (never exposed to browser)    |
| `BRIEFING_INGEST_SECRET`       | Shared secret for `POST /api/briefing/ingest`       |
| `ELEVENLABS_API_KEY`           | ElevenLabs                                          |
| `ELEVENLABS_VOICE_ID_EN`       | English voice                                       |
| `ELEVENLABS_VOICE_ID_NO`       | Norwegian voice                                     |
| `WEBAPP_URL`                   | (generator only) Base URL of the deployed webapp    |

### Running the database migration

The schema lives at `supabase/migrations/0001_init.sql`. Apply it however you
manage Supabase migrations — quickest path is the Supabase SQL editor:

1. Open your project's SQL editor.
2. Paste the contents of `supabase/migrations/0001_init.sql`.
3. Run.

Or with the Supabase CLI:

```bash
supabase db push    # if you've linked the project
# or
psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
```

Row Level Security is left off intentionally — all DB access goes through the
server-side service-role key.

## API

- `POST /api/briefing/ingest` — requires `x-briefing-secret` header. Upserts
  by `briefing_date`. Body is validated with zod. Accepts an optional
  `link_previews` map (URL → `{title?, excerpt?, host?}`) that seeds the link
  hovercards without a round-trip.
- `GET /api/briefing/latest` — returns the most recent briefing.
- `POST /api/audio/en` — body `{ briefingDate: "YYYY-MM-DD" }`. Streams MP3.
- `POST /api/audio/no` — same but Norwegian.
- `POST /api/user` — body `{ name }`. Used by the boot screen.
- `GET /api/link-preview?url=...` — lazily fetches a URL, extracts a title and
  a body excerpt (no external dependencies — small regex extractor in
  `lib/extract.ts`). Used by the link hovercards when the briefing payload
  doesn't include a seed preview for that URL.

## Link hovercards

Markdown links in `synthesis_md` get a Gwern-style hover preview:

- Hover delay: 140ms (avoids flicker on grazing-mouse passes).
- Card content sources, in order: (1) the `link_previews` map sent in the ingest
  payload, then (2) a live fetch to `/api/link-preview?url=...`.
- Card is scrollable when the article body exceeds 280px; positions above the
  link if there's no room below.
- The extractor strips `<script>`/`<style>`, prefers `<p>` text inside the
  document body, and falls back to `og:description`. Pages that are JS-only
  shells will yield only a host badge — that's fine and intentional. If you
  want richer previews for those, pass them in via `link_previews` from the
  generator.

## Generator script

See [`scripts/briefing-generator/README.md`](scripts/briefing-generator/README.md)
for how to run it locally and how to wire it into Claude Cowork or a plain
cron / GitHub Actions schedule.

The generator is split so the LLM-driven prose step lives in
`scripts/briefing-generator/synthesize.ts`, which a Cowork run can overwrite or
replace at runtime. The default impl is a placeholder.

## UX flow

- **First visit**: full main UI rendered behind a 24px blur + 70% black tint.
  A `> identify yourself` prompt captures the user's name; pressing Enter or
  `[ go ]` POSTs `/api/user`, stores `{ id, name }` in `localStorage` under
  `briefing.user`, and runs the whoosh animation (blur 24 → 0, opacity 0.6 → 1,
  translateY 8 → 0, 700ms ease-out).
- **Return visits**: skip the boot screen, render the main UI directly.
- **Main UI**: themes heading (VT323, glow) at top, lowercase date line, the
  synthesis block (`react-markdown` inside a 1px-bordered card), and two
  equal-width audio buttons at the bottom.

## Visual rules

- Only `#000` and `#FFF`. Grays are achieved via `rgba(...,X)` on the active foreground colour.
- No icons, emoji, decorative borders, or shadows beyond the text glow.
- A theme toggle in the top-right flips between dark (black bg, white fg, soft white glow) and light (white bg, black fg, soft dark drop-shadow on text for contrast). The chosen theme is persisted in `localStorage.briefing.theme` and applied via a no-flash inline script in `<head>` so the first paint is correct.
- `themes_heading` should be written in **natural case** so acronyms read as acronyms (e.g. `Kyiv hit · Ebola declared PHEIC · AI infra arms race`). The date line below it stays lowercase via CSS — that's the only forced lowercase in the layout.

## Notes / decisions

- `synthesize.ts` is intentionally a stub. The README in
  `scripts/briefing-generator/` explains how to plug a real LLM step in. We do
  not call the Anthropic API from this codebase.
- The user `name` is persisted to the DB and to `localStorage` but is **not**
  displayed anywhere yet — it's reserved for future personalization.
- Audio playback uses the native `<audio controls>` element with a small CSS
  filter applied to fit the black/white palette. Replacing it with a custom
  scrubber is a deliberate non-goal for v1.
- The boot screen submit button is disabled while the name is empty so an
  accidental empty POST won't write a blank row.
- The original spec said "no light/dark toggle"; that constraint was overridden
  later. The toggle lives in `components/ThemeToggle.tsx` and themes the rest
  of the UI through CSS custom properties (`--bg`, `--fg`, `--glow-strong`,
  etc.) defined in `app/globals.css`.

## Deploying to Vercel

1. Push to GitHub.
2. Import the repo in Vercel.
3. Add the env vars from the table above (don't forget the Supabase ones).
4. Deploy. The first POST to `/api/briefing/ingest` will create row #1.
