/**
 * Build-time bird data aggregate — the Astro equivalent of birdworks'
 * src/_data/birds.js. Fetched once per build (module-level memoization),
 * shared by every prerendered page.
 *
 * On API failure this returns the empty-fallback shape instead of throwing,
 * so a CMS outage produces an empty-but-valid site rather than a failed
 * build. Every consumer must render sensible empty states.
 */
import {
  API_BASE,
  fetchDaily,
  fetchFeaturedPhotos,
  fetchHourly,
  fetchLatest,
  fetchPhotos,
  fetchRecent,
  fetchSpecies,
  type DailyCount,
  type Detection,
  type HourlyHour,
  type Photo,
  type RecentDetection,
  type SpeciesCount,
} from "./api";

export interface BirdsData {
  today: Detection[];
  todayDate: string | null;
  species: SpeciesCount[];
  daily: DailyCount[];
  hourly: HourlyHour[];
  recent: RecentDetection[];
  photos: Photo[];
  featuredPhotos: Photo[];
  generatedAt: string;
  apiBase: string;
  error?: string;
}

let cached: Promise<BirdsData> | undefined;

export function getBirdsData(): Promise<BirdsData> {
  cached ??= loadBirdsData();
  return cached;
}

async function loadBirdsData(): Promise<BirdsData> {
  console.log(`🐦 Fetching bird data from: ${API_BASE}`);

  try {
    const [today, species, daily, hourly, recent, photos, featuredPhotos] =
      await Promise.all([
        fetchLatest(),
        fetchSpecies(),
        fetchDaily(30),
        fetchHourly("today"),
        fetchRecent(30),
        fetchPhotos(100),
        fetchFeaturedPhotos(),
      ]);

    const generatedAt = new Date().toISOString();

    console.log(`✅ Bird data fetched successfully:`);
    console.log(`   - ${today.detections.length} detections today (${today.date ?? "unknown"})`);
    console.log(`   - ${species.species.length} species`);
    console.log(`   - ${daily.daily.length} days of data`);
    console.log(`   - ${hourly.total_detections} detections in today's hourly breakdown`);
    console.log(`   - ${recent.detections.length} recent detections (last ${recent.days} days)`);
    console.log(`   - ${photos.photos.length} photos (${featuredPhotos.photos.length} featured)`);

    return {
      today: today.detections,
      todayDate: today.date,
      species: species.species,
      daily: daily.daily,
      hourly: hourly.hours,
      recent: recent.detections,
      photos: photos.photos,
      featuredPhotos: featuredPhotos.photos,
      generatedAt,
      apiBase: API_BASE,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to fetch bird data: ${message}`);
    console.log("⚠️  Using empty fallback data");

    return {
      today: [],
      todayDate: null,
      species: [],
      daily: [],
      hourly: [],
      recent: [],
      photos: [],
      featuredPhotos: [],
      generatedAt: new Date().toISOString(),
      apiBase: API_BASE,
      error: message,
    };
  }
}
