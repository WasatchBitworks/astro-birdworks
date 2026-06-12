/**
 * Browser-side API helpers for island scripts. The server-side client
 * (api.ts) reads process.env and must not be imported in client code;
 * the API base reaches the browser via <html data-api-base> (set in Base.astro).
 */
export const CLIENT_SLUG = "wasatch-bitworks";

export function apiBase(): string {
  return (
    document.documentElement.dataset.apiBase ||
    "https://cms.wasatchbitworks.com/api/birds"
  );
}

/** `${apiBase()}/${CLIENT_SLUG}` — root for all public endpoints */
export function apiRoot(): string {
  return `${apiBase()}/${CLIENT_SLUG}`;
}

/** Resolve a relative audio_url ("/api/birds/...") against the CMS origin */
export function absoluteAudioUrl(audioUrl: string): string {
  if (audioUrl.startsWith("http")) return audioUrl;
  return new URL(apiBase()).origin + audioUrl;
}
