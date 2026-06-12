/**
 * Exact port of the birdworks Eleventy `slugify` filter (.eleventy.js).
 * Species URLs (/species/:slug/) and the CMS presence endpoint both depend
 * on this producing identical output — e.g. "Woodhouse's Scrub-Jay" →
 * "woodhouses-scrub-jay". Do not "improve" the algorithm.
 */
export function slugify(text: string | null | undefined): string {
  if (!text) return "";

  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}
