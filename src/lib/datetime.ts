/**
 * Mountain Time display formatting. API timestamps are UTC ISO 8601.
 * Always go through toLocaleString with an explicit timeZone — never
 * manual UTC offsets (DST). Canonical reference: CMS docs/birds/BIRDS.md.
 *
 * Shared by server (frontmatter) and client (island scripts).
 */
const TZ = "America/Denver";

/** "Jan 7, 2026, 4:34 PM" */
export function toMountainTime(dateString: string | null | undefined): string {
  if (!dateString) return "";
  try {
    return new Date(dateString).toLocaleString("en-US", {
      timeZone: TZ,
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return dateString;
  }
}

/** "4:34 PM" */
export function toMountainTimeShort(dateString: string | null | undefined): string {
  if (!dateString) return "";
  try {
    return new Date(dateString).toLocaleString("en-US", {
      timeZone: TZ,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return dateString;
  }
}

/** "Jan 7, 2026" — date-only strings (YYYY-MM-DD) are anchored to UTC noon so
 * the Mountain Time rendering can't slip a day */
export function toMountainDate(dateString: string | null | undefined): string {
  if (!dateString) return "";
  try {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(dateString)
      ? new Date(`${dateString}T12:00:00Z`)
      : new Date(dateString);
    return date.toLocaleString("en-US", {
      timeZone: TZ,
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}
