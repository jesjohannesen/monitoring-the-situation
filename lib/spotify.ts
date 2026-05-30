import { cookies } from "next/headers";

// Cookie names — kept short to fit comfortably under header limits.
const COOKIE_ACCESS = "sp_access";
const COOKIE_REFRESH = "sp_refresh";
const COOKIE_EXPIRES = "sp_expires"; // unix seconds

// All scopes we need:
//   streaming                          → Web Playback SDK can stream audio
//   user-read-email + user-read-private→ /me works (display name, country)
//   user-modify-playback-state         → start playback on our SDK device
//   user-read-playback-state           → check what's currently playing
//   user-read-currently-playing        → ditto
export const SPOTIFY_SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-modify-playback-state",
  "user-read-playback-state",
  "user-read-currently-playing",
].join(" ");

export function getEnv() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET in environment",
    );
  }
  return { clientId, clientSecret };
}

// Derive the callback URL from the inbound request so dev (127.0.0.1) and
// prod (Vercel) Just Work without per-env config. We registered both in the
// Spotify dashboard.
export function callbackUrlFor(origin: string): string {
  return `${origin}/api/spotify/callback`;
}

// Build the origin from the inbound request's Host header, falling back to
// x-forwarded-* when behind Vercel's edge. Avoid `new URL(req.url).origin`
// because Next dev rewrites that to localhost regardless of the real host.
export function originFromRequest(req: Request): string {
  const headers = req.headers;
  const forwardedHost = headers.get("x-forwarded-host");
  const forwardedProto = headers.get("x-forwarded-proto");
  const host = forwardedHost ?? headers.get("host") ?? "127.0.0.1:3100";
  const proto =
    forwardedProto ??
    (host.startsWith("localhost") || host.startsWith("127.")
      ? "http"
      : "https");
  return `${proto}://${host}`;
}

type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  refresh_token?: string;
};

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const { clientId, clientSecret } = getEnv();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization:
        "Basic " +
        Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
    },
    body,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`spotify token exchange failed: ${res.status} ${detail}`);
  }
  return (await res.json()) as TokenResponse;
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<TokenResponse> {
  const { clientId, clientSecret } = getEnv();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization:
        "Basic " +
        Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
    },
    body,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`spotify token refresh failed: ${res.status} ${detail}`);
  }
  return (await res.json()) as TokenResponse;
}

const isProd = process.env.NODE_ENV === "production";

export function writeTokenCookies(t: TokenResponse, refreshFallback?: string) {
  const jar = cookies();
  const expiresAt = Math.floor(Date.now() / 1000) + (t.expires_in ?? 3600);
  // Long-lived: 365 days. Spotify's refresh tokens don't expire in practice
  // (only revoked manually), so we ride that out and refresh access on demand.
  const refreshMaxAge = 365 * 24 * 3600;
  jar.set(COOKIE_ACCESS, t.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: t.expires_in,
  });
  jar.set(COOKIE_EXPIRES, String(expiresAt), {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: refreshMaxAge,
  });
  const refresh = t.refresh_token ?? refreshFallback;
  if (refresh) {
    jar.set(COOKIE_REFRESH, refresh, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: "/",
      maxAge: refreshMaxAge,
    });
  }
}

export function clearTokenCookies() {
  const jar = cookies();
  for (const n of [COOKIE_ACCESS, COOKIE_REFRESH, COOKIE_EXPIRES]) {
    jar.set(n, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: "/",
      maxAge: 0,
    });
  }
}

// Read the current tokens out of cookies. If the access token is expired (or
// within ~30s of expiring), refresh it transparently.
export async function getValidAccessToken(): Promise<string | null> {
  const jar = cookies();
  const access = jar.get(COOKIE_ACCESS)?.value;
  const refresh = jar.get(COOKIE_REFRESH)?.value;
  const expires = Number(jar.get(COOKIE_EXPIRES)?.value ?? 0);
  const now = Math.floor(Date.now() / 1000);

  if (!refresh && !access) return null;
  if (access && expires > now + 30) {
    return access;
  }
  if (!refresh) return null;
  // Refresh.
  try {
    const t = await refreshAccessToken(refresh);
    writeTokenCookies(t, refresh);
    return t.access_token;
  } catch {
    clearTokenCookies();
    return null;
  }
}
