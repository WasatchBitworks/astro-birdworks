import type { Photo } from "./api";

/** First photo for a species, preferring featured photos. Null if none. */
export function findPhotoBySpecies(
  photos: Photo[],
  speciesName: string | null | undefined,
): Photo | null {
  const matches = filterPhotosBySpecies(photos, speciesName);
  if (matches.length === 0) return null;
  return matches.find((p) => p.is_featured) ?? matches[0]!;
}

/** All photos for a species, by common name. */
export function filterPhotosBySpecies(
  photos: Photo[],
  speciesName: string | null | undefined,
): Photo[] {
  if (!speciesName) return [];
  return photos.filter((p) => p.species?.common_name === speciesName);
}
