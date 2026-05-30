"use client";

import { useCallback, useEffect, useState } from "react";
import type { SongSuggestion } from "@/lib/supabase";
import { SpotifyPlayer } from "./SpotifyPlayer";
import { toggleSymbol, useDataStyle } from "@/lib/useDataStyle";

type Props = {
  song: SongSuggestion | null | undefined;
};

type MeResp =
  | { logged_in: false }
  | { logged_in: true; display_name: string; product: string };

type Resolved = {
  uri: string;
  name: string;
  artist: string;
  album?: string;
  album_art?: string;
  external_url?: string;
};

const OPEN_KEY = "briefing.song-of-day.open";

export function SongOfDay({ song }: Props) {
  const [me, setMe] = useState<MeResp | null>(null);
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [resolveErr, setResolveErr] = useState<string | null>(null);
  const [playErr, setPlayErr] = useState<string | null>(null);
  // Toggle-able card. Default open; collapsed state is persisted across
  // reloads. Reading happens in a mount effect so SSR/hydration stays clean.
  const [open, setOpen] = useState(true);
  const dataStyle = useDataStyle();
  useEffect(() => {
    try {
      if (localStorage.getItem(OPEN_KEY) === "0") setOpen(false);
    } catch {
      /* ignore */
    }
  }, []);
  function toggleOpen() {
    setOpen((o) => {
      const next = !o;
      try {
        localStorage.setItem(OPEN_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  // Check login state once on mount and whenever the URL gains ?spotify=ok
  // (callback redirect).
  useEffect(() => {
    refreshMe();
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.has("spotify")) {
      // Clean the query so the redirect breadcrumb doesn't stick.
      const status = url.searchParams.get("spotify");
      url.searchParams.delete("spotify");
      window.history.replaceState({}, "", url.toString());
      if (status === "ok") refreshMe();
    }
  }, []);

  async function refreshMe() {
    try {
      const r = await fetch("/api/spotify/me", { cache: "no-store" });
      const j = (await r.json()) as MeResp;
      setMe(j);
    } catch {
      setMe({ logged_in: false });
    }
  }

  const resolveTrack = useCallback(async () => {
    if (!song || resolved) return;
    setResolveErr(null);
    try {
      const u = new URL("/api/spotify/search", window.location.origin);
      u.searchParams.set("title", song.spotify_uri ? "" : song.title);
      u.searchParams.set("artist", song.artist);
      if (song.spotify_uri) {
        // Already have it — no need to search.
        setResolved({
          uri: song.spotify_uri,
          name: song.title,
          artist: song.artist,
          external_url: song.spotify_external_url,
        });
        return;
      }
      const r = await fetch(
        `/api/spotify/search?title=${encodeURIComponent(
          song.title,
        )}&artist=${encodeURIComponent(song.artist)}`,
        { cache: "no-store" },
      );
      if (!r.ok) throw new Error(`search ${r.status}`);
      const j = (await r.json()) as { track: Resolved | null };
      if (!j.track) throw new Error("no match found");
      setResolved(j.track);
    } catch (e) {
      setResolveErr(e instanceof Error ? e.message : "search failed");
    }
  }, [song, resolved]);

  // Resolve the track once we know we're logged in (and have a song).
  useEffect(() => {
    if (me?.logged_in && song) void resolveTrack();
  }, [me?.logged_in, song, resolveTrack]);

  if (!song) return null;

  const fallbackHref =
    resolved?.external_url ??
    song.spotify_external_url ??
    `https://open.spotify.com/search/${encodeURIComponent(
      `${song.title} ${song.artist}`,
    )}`;

  return (
    <div style={{ marginBottom: "20px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: open ? "8px" : 0,
        }}
      >
        <button
          type="button"
          onClick={toggleOpen}
          aria-expanded={open}
          className="song-of-day-toggle"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--fg)",
            fontFamily: "var(--font-display), monospace",
            fontSize: "var(--toggle-size)",
            opacity: 0.6,
            textShadow: "var(--glow-soft)",
            letterSpacing: "0.03em",
            cursor: "pointer",
            padding: 0,
            textAlign: "left",
          }}
        >
          &gt; song of the day {toggleSymbol(dataStyle, open)}
        </button>
        {open && me?.logged_in && (
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/spotify/logout", { method: "POST" });
              setMe({ logged_in: false });
              setResolved(null);
            }}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--fg)",
              fontFamily: "var(--font-ui), monospace",
              fontSize: "10px",
              letterSpacing: "0.06em",
              opacity: 0.45,
              cursor: "pointer",
              padding: 0,
            }}
            title="disconnect spotify"
          >
            [ log out spotify ]
          </button>
        )}
      </div>

      {/* Card */}
      {open && (
      <div
        style={{
          border: "1px solid var(--border-soft)",
          padding: "12px 14px",
          fontFamily: "var(--font-ui), monospace",
          color: "var(--fg)",
          display: "flex",
          gap: "12px",
          alignItems: "flex-start",
        }}
      >
        {resolved?.album_art && (
          <a
            href={fallbackHref}
            target="_blank"
            rel="noopener noreferrer"
            style={{ flexShrink: 0 }}
          >
            <img
              src={resolved.album_art}
              alt=""
              width={64}
              height={64}
              style={{
                display: "block",
                border: "1px solid var(--border-soft)",
              }}
            />
          </a>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "15px",
              lineHeight: 1.4,
              overflowWrap: "anywhere",
              fontWeight: 500,
            }}
          >
            {song.title}{" "}
            <span style={{ opacity: 0.55, fontWeight: 400 }}>—</span>{" "}
            <span style={{ opacity: 0.85, fontWeight: 400 }}>
              {song.artist}
            </span>
          </div>
          {song.why && (
            <div
              style={{
                marginTop: "4px",
                fontSize: "12px",
                opacity: 0.65,
                fontStyle: "italic",
                lineHeight: 1.55,
                overflowWrap: "anywhere",
              }}
            >
              {song.why}
            </div>
          )}

          {/* Controls row */}
          <div
            style={{
              marginTop: "10px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            {me === null && (
              <span style={{ fontSize: "11px", opacity: 0.5 }}>
                &gt; checking…
              </span>
            )}
            {me?.logged_in === false && (
              <a
                href={`/api/spotify/auth?return_to=${encodeURIComponent(
                  typeof window !== "undefined"
                    ? window.location.pathname + window.location.search
                    : "/",
                )}`}
                style={{
                  ...buttonStyle,
                  textDecoration: "none",
                  display: "inline-block",
                }}
              >
                [ log in to spotify ]
              </a>
            )}
            {me?.logged_in && me.product !== "premium" && (
              <span style={{ fontSize: "11px", opacity: 0.65 }}>
                &gt; premium required for in-app playback —{" "}
                <a
                  href={fallbackHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--fg)" }}
                >
                  open in spotify
                </a>
              </span>
            )}
            {me?.logged_in && me.product === "premium" && resolved && (
              <SpotifyPlayer>
                {({ state, play, pause, resume, isPaused }) => {
                  const label =
                    state.kind === "loading"
                      ? "[ ... connecting ]"
                      : state.kind === "error"
                        ? "[ error ]"
                        : !state || state.kind !== "ready"
                          ? "[ ... ]"
                          : isPaused
                            ? "[ play ]"
                            : "[ pause ]";
                  return (
                    <>
                      <button
                        type="button"
                        disabled={state.kind !== "ready"}
                        onClick={async () => {
                          setPlayErr(null);
                          try {
                            if (isPaused) {
                              // First click: hand off to our device + start.
                              // Subsequent clicks: just resume.
                              await play(resolved.uri);
                            } else {
                              await pause();
                            }
                          } catch (e) {
                            setPlayErr(
                              e instanceof Error ? e.message : "play failed",
                            );
                          }
                        }}
                        style={buttonStyle}
                      >
                        {label}
                      </button>
                      {state.kind === "error" && (
                        <span style={{ fontSize: "11px", opacity: 0.6 }}>
                          {state.message}
                        </span>
                      )}
                    </>
                  );
                }}
              </SpotifyPlayer>
            )}
            {me?.logged_in && me.product === "premium" && !resolved && (
              <span style={{ fontSize: "11px", opacity: 0.55 }}>
                &gt; {resolveErr ? `error: ${resolveErr}` : "finding track…"}
              </span>
            )}
            {playErr && (
              <span style={{ fontSize: "11px", opacity: 0.6 }}>
                {playErr}
              </span>
            )}
            <a
              href={fallbackHref}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: "11px",
                opacity: 0.45,
                color: "var(--fg)",
                marginLeft: "auto",
              }}
            >
              ↗ spotify
            </a>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--border-strong)",
  color: "var(--fg)",
  fontFamily: "var(--font-ui), monospace",
  fontSize: "11px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  padding: "6px 12px",
  cursor: "pointer",
  textShadow: "var(--glow-soft)",
  transition: "all 120ms ease-out",
};
