"use client";

import { useCallback, useEffect, useState } from "react";

// Minimal subset of the Spotify Web Playback SDK types we use.
type SDKPlayer = {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  addListener: (event: string, cb: (payload: unknown) => void) => void;
  removeListener: (event: string, cb?: (payload: unknown) => void) => void;
  togglePlay: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  setVolume: (v: number) => Promise<void>;
  getCurrentState: () => Promise<{
    paused: boolean;
    position: number;
    duration: number;
    track_window?: { current_track?: { uri?: string } };
  } | null>;
  // Safari autoplay-policy workaround — must be called inside a user gesture
  // frame. No-op in browsers without strict autoplay (Chrome/Firefox/Edge).
  // Marked optional because older SDK versions don't expose it.
  activateElement?: () => Promise<void>;
};

declare global {
  interface Window {
    Spotify?: {
      Player: new (options: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }) => SDKPlayer;
    };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

export type SpotifyPlayerState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; deviceId: string }
  | { kind: "error"; message: string };

/* ──────────────────────────────────────────────────────────────────────
 * Module-level singleton — survives React mounts/unmounts so navigating
 * between pages doesn't tear the SDK device down. Spotify's backend can
 * take several seconds to register a new device, so reusing one across
 * navigations avoids the "Device not found" race entirely.
 * ────────────────────────────────────────────────────────────────────── */

let modulePlayer: SDKPlayer | null = null;
let moduleDeviceId: string | null = null;
let moduleState: SpotifyPlayerState = { kind: "idle" };
let moduleIsPaused = true;
let moduleCurrentUri: string | null = null;
let sdkLoadStarted = false;
const subscribers = new Set<() => void>();

function notify() {
  subscribers.forEach((cb) => cb());
}

function setModuleState(next: SpotifyPlayerState) {
  moduleState = next;
  notify();
}

async function fetchAccessToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/spotify/token", { cache: "no-store" });
    if (!res.ok) return null;
    const j = (await res.json()) as { access_token: string };
    return j.access_token;
  } catch {
    return null;
  }
}

function ensurePlayer() {
  if (modulePlayer) return;
  if (typeof window === "undefined" || !window.Spotify) return;

  const player = new window.Spotify.Player({
    name: "briefing — song of the day",
    getOAuthToken: async (cb) => {
      const t = await fetchAccessToken();
      if (t) cb(t);
    },
    volume: 0.6,
  });
  modulePlayer = player;
  setModuleState({ kind: "loading" });

  player.addListener("ready", (p) => {
    const deviceId = (p as { device_id: string }).device_id;
    moduleDeviceId = deviceId;
    setModuleState({ kind: "ready", deviceId });
  });
  player.addListener("not_ready", () => {
    moduleDeviceId = null;
    setModuleState({ kind: "loading" });
  });
  player.addListener("initialization_error", (e) =>
    setModuleState({
      kind: "error",
      message: (e as { message: string }).message,
    }),
  );
  player.addListener("authentication_error", (e) =>
    setModuleState({
      kind: "error",
      message:
        "spotify auth expired — log in again (" +
        (e as { message: string }).message +
        ")",
    }),
  );
  player.addListener("account_error", () =>
    setModuleState({
      kind: "error",
      message: "premium required for in-app playback",
    }),
  );
  player.addListener("player_state_changed", (p) => {
    if (!p) return;
    const ps = p as {
      paused: boolean;
      track_window?: { current_track?: { uri?: string } };
    };
    moduleIsPaused = ps.paused;
    const uri = ps.track_window?.current_track?.uri;
    if (uri) moduleCurrentUri = uri;
    notify();
  });
  player.connect();
}

function loadSDKAndConnect() {
  if (typeof window === "undefined") return;
  if (window.Spotify) {
    ensurePlayer();
    return;
  }
  if (sdkLoadStarted) return;
  sdkLoadStarted = true;
  window.onSpotifyWebPlaybackSDKReady = ensurePlayer;
  if (!document.querySelector('script[data-spotify-sdk="1"]')) {
    const s = document.createElement("script");
    s.src = "https://sdk.scdn.co/spotify-player.js";
    s.async = true;
    s.dataset.spotifySdk = "1";
    document.body.appendChild(s);
  }
}

// Fire-and-forget pause helper for callers outside the React render tree
// (e.g. ThemeToggle wants to hush the music when entering paul-allen so
// the sting plays unobstructed). Safe to call when nothing is playing.
export function pauseSpotify(): void {
  try {
    void modulePlayer?.pause();
  } catch {
    /* ignore */
  }
}

// Called by the player to externally reset (e.g. on logout).
export function resetSpotifyPlayer() {
  modulePlayer?.disconnect();
  modulePlayer = null;
  moduleDeviceId = null;
  moduleCurrentUri = null;
  moduleState = { kind: "idle" };
  moduleIsPaused = true;
  notify();
}

/* ─── play / pause helpers ─────────────────────────────────────────────── */

async function waitForDevice(maxMs = 6000): Promise<string | null> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (moduleDeviceId) return moduleDeviceId;
    await new Promise((r) => setTimeout(r, 100));
  }
  return moduleDeviceId;
}

async function rebuildPlayer(): Promise<string | null> {
  try {
    modulePlayer?.disconnect();
  } catch {
    /* ignore */
  }
  modulePlayer = null;
  moduleDeviceId = null;
  moduleCurrentUri = null;
  setModuleState({ kind: "loading" });
  ensurePlayer();
  return waitForDevice();
}

async function play(uri: string): Promise<void> {
  // Safari autoplay fix: activateElement() must be called inside the same
  // user-gesture frame as the click that triggered play. Calling it before
  // any `await` keeps us inside that frame. No-op in browsers without
  // strict autoplay policy. Don't await — let the SDK handle it in parallel
  // with the rest of our setup so we don't break the gesture chain.
  try {
    modulePlayer?.activateElement?.();
  } catch {
    /* ignore — older SDK or unsupported browser */
  }

  // If this same track is already loaded, just resume from where we paused
  // — don't restart it from position 0.
  if (moduleCurrentUri === uri && modulePlayer) {
    try {
      await modulePlayer.resume();
      return;
    } catch {
      // Fall through to the API path if the SDK refuses for any reason.
    }
  }

  let access = await fetchAccessToken();
  let deviceId = moduleDeviceId;
  if (!access) throw new Error("not logged in");
  if (!deviceId) {
    // Device hasn't registered yet — wait briefly.
    deviceId = await waitForDevice(3000);
    if (!deviceId) throw new Error("player not ready");
  }

  async function attempt(id: string): Promise<Response> {
    return fetch(
      `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(
        id,
      )}`,
      {
        method: "PUT",
        headers: {
          authorization: `Bearer ${access!}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ uris: [uri] }),
      },
    );
  }

  let res = await attempt(deviceId);

  // 404 "Device not found" → the device handle Spotify gave us is stale.
  // This commonly happens after page navigation: the SDK's WebSocket dies
  // silently and the device is deregistered server-side even though our JS
  // ref still holds the old id. Tear down and rebuild a fresh device.
  if (res.status === 404) {
    const newId = await rebuildPlayer();
    if (!newId) throw new Error("could not register a fresh device");
    deviceId = newId;
    // Make sure the fresh device gets selected before play.
    await fetch("https://api.spotify.com/v1/me/player", {
      method: "PUT",
      headers: {
        authorization: `Bearer ${access}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ device_ids: [deviceId], play: false }),
    });
    await new Promise((r) => setTimeout(r, 400));
    res = await attempt(deviceId);
  }
  if (!res.ok && res.status !== 204) {
    const detail = await res.text().catch(() => "");
    throw new Error(`play failed: ${res.status} ${detail}`);
  }
}

async function pause(): Promise<void> {
  await modulePlayer?.pause();
}
async function resume(): Promise<void> {
  await modulePlayer?.resume();
}

/* ─── component (render-prop wrapper around the singleton) ─────────────── */

type Props = {
  children: (props: {
    state: SpotifyPlayerState;
    play: (uri: string) => Promise<void>;
    pause: () => Promise<void>;
    resume: () => Promise<void>;
    isPaused: boolean;
  }) => React.ReactNode;
};

export function SpotifyPlayer({ children }: Props) {
  const [, force] = useState(0);

  useEffect(() => {
    const cb = () => force((n) => n + 1);
    subscribers.add(cb);
    loadSDKAndConnect();
    // Mirror current module state right away.
    cb();
    return () => {
      subscribers.delete(cb);
      // Intentionally don't disconnect — keep the device alive across
      // page navigations.
    };
  }, []);

  const playWrapped = useCallback(play, []);
  const pauseWrapped = useCallback(pause, []);
  const resumeWrapped = useCallback(resume, []);

  return (
    <>
      {children({
        state: moduleState,
        play: playWrapped,
        pause: pauseWrapped,
        resume: resumeWrapped,
        isPaused: moduleIsPaused,
      })}
    </>
  );
}
