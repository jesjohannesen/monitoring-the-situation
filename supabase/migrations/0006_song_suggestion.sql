alter table briefings
  add column if not exists song_suggestion jsonb;

-- Shape (set by the Cowork routine):
--   { "title": "...", "artist": "...", "why": "..." }
-- Optional fields filled in later by the client once resolved through Spotify:
--   { ..., "spotify_uri": "spotify:track:...", "spotify_external_url": "https://open.spotify.com/track/..." }
