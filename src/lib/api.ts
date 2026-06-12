/**
 * Typed client for the Bitworks CMS Birds API.
 *
 * Response shapes mirror birds/app.rb in the CMS repo. All timestamps are
 * UTC ISO 8601; display formatting is Mountain Time (see datetime.ts).
 * Photo variant URLs are stable redirect endpoints (never expire) — use them
 * directly in <img src>, never the underlying S3 URLs.
 */

export const API_BASE =
  process.env.BIRDS_API_BASE ?? "https://cms.wasatchbitworks.com/api/birds";
export const CLIENT_SLUG = "wasatch-bitworks";

// --- Response types -------------------------------------------------------

export interface Detection {
  id: number;
  common_name: string;
  scientific_name: string;
  confidence: number;
  detected_at: string;
  preserved: boolean;
  /** Relative path to the audio pre-sign endpoint, or null when no recording */
  audio_url: string | null;
}

export interface LatestResponse {
  detections: Detection[];
  count: number;
  date: string | null;
  generated_at: string;
}

export interface SpeciesCount {
  common_name: string;
  scientific_name: string;
  detection_count: number;
  preserved_count: number;
  max_confidence: number;
  avg_confidence: number;
  last_seen: string;
}

export interface SpeciesResponse {
  species: SpeciesCount[];
  count: number;
  generated_at: string;
}

export interface DailyCount {
  date: string;
  count: number;
}

export interface DailyResponse {
  daily: DailyCount[];
  total: number;
  days: number;
  generated_at: string;
}

export interface HourlySpeciesCount {
  common_name: string;
  scientific_name?: string;
  count: number;
}

export interface HourlyHour {
  hour: number; // 0-23, always all 24 present
  total: number;
  species: HourlySpeciesCount[];
}

export interface HourlyResponse {
  date: string;
  hours: HourlyHour[];
  total_detections: number;
  generated_at: string;
}

export interface RecentDetection {
  id: number;
  common_name: string;
  scientific_name: string;
  confidence: number;
  detected_at: string;
  preserved: boolean;
}

export interface RecentResponse {
  detections: RecentDetection[];
  count: number;
  days: number;
  generated_at: string;
}

export interface PhotoVariant {
  /** Stable redirect URL — never expires */
  url: string;
  width: number | null;
  height: number | null;
  format: string;
  size_bytes: number | null;
}

export interface Photo {
  id: number;
  species: {
    common_name: string;
    scientific_name: string;
    slug: string;
  };
  caption: string | null;
  is_featured: boolean;
  taken_at: string | null;
  uploaded_at: string;
  variants: Partial<Record<"thumbnail" | "medium" | "large", PhotoVariant>>;
}

export interface PhotosResponse {
  photos: Photo[];
  /** Present on /photos (paginated, max 100/page); absent on /photos/featured */
  pagination?: { page: number; per_page: number; has_more: boolean };
  count?: number;
}

export interface PresenceResponse {
  species: string;
  days: number;
  dates: string[]; // ISO dates (YYYY-MM-DD) with at least one detection
  count: number;
  generated_at: string;
}

// --- Fetch helpers --------------------------------------------------------

async function getJSON<T>(path: string): Promise<T> {
  const url = `${API_BASE}/${CLIENT_SLUG}${path}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "BirdWorks-Astro-Site/1.0" },
  });
  if (!res.ok) {
    throw new Error(`Birds API ${res.status} for ${url}`);
  }
  return res.json() as Promise<T>;
}

export const fetchLatest = (params = "?date=today&limit=200") =>
  getJSON<LatestResponse>(`/latest${params}`);

// Explicit limit=500 (API max): the endpoint defaults to 100 and the site is
// already at 99 species — birdworks' default-limit fetch silently truncates
// at the 100th species.
export const fetchSpecies = () =>
  getJSON<SpeciesResponse>(`/detections/species?limit=500`);

export const fetchDaily = (days = 30) =>
  getJSON<DailyResponse>(`/daily?days=${days}`);

export const fetchHourly = (date = "today") =>
  getJSON<HourlyResponse>(`/hourly?date=${date}`);

export const fetchRecent = (days = 30) =>
  getJSON<RecentResponse>(`/detections/recent?days=${days}`);

// API caps at 100 per page; site currently has well under 100 photos.
// If the library ever exceeds 100, pagination.has_more will be true and
// this needs a paging loop.
export const fetchPhotos = (perPage = 100) =>
  getJSON<PhotosResponse>(`/photos?per_page=${perPage}`);

export const fetchFeaturedPhotos = () =>
  getJSON<PhotosResponse>(`/photos/featured`);

export const fetchPresence = (speciesSlug: string, days = 365) =>
  getJSON<PresenceResponse>(`/species/${speciesSlug}/presence?days=${days}`);
