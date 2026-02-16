// Curated list of major IANA timezones with display labels.
// This is the authoritative list — used for both the settings dropdown and
// timezone validation at write time.
export const TIMEZONES = [
  { label: "Pacific/Honolulu — Hawaii (UTC−10)", value: "Pacific/Honolulu" },
  { label: "America/Anchorage — Alaska (UTC−9)", value: "America/Anchorage" },
  { label: "America/Los_Angeles — Pacific Time (UTC−8/−7)", value: "America/Los_Angeles" },
  { label: "America/Denver — Mountain Time (UTC−7/−6)", value: "America/Denver" },
  { label: "America/Phoenix — Arizona (UTC−7, no DST)", value: "America/Phoenix" },
  { label: "America/Chicago — Central Time (UTC−6/−5)", value: "America/Chicago" },
  { label: "America/New_York — Eastern Time (UTC−5/−4)", value: "America/New_York" },
  { label: "America/Halifax — Atlantic Time (UTC−4/−3)", value: "America/Halifax" },
  { label: "America/St_Johns — Newfoundland (UTC−3:30/−2:30)", value: "America/St_Johns" },
  { label: "America/Sao_Paulo — Brazil (UTC−3)", value: "America/Sao_Paulo" },
  { label: "America/Argentina/Buenos_Aires — Argentina (UTC−3)", value: "America/Argentina/Buenos_Aires" },
  { label: "Atlantic/Azores — Azores (UTC−1)", value: "Atlantic/Azores" },
  { label: "Europe/London — UK (UTC+0/+1)", value: "Europe/London" },
  { label: "Europe/Paris — Central Europe (UTC+1/+2)", value: "Europe/Paris" },
  { label: "Europe/Helsinki — Eastern Europe (UTC+2/+3)", value: "Europe/Helsinki" },
  { label: "Europe/Istanbul — Turkey (UTC+3)", value: "Europe/Istanbul" },
  { label: "Asia/Dubai — Gulf (UTC+4)", value: "Asia/Dubai" },
  { label: "Asia/Karachi — Pakistan (UTC+5)", value: "Asia/Karachi" },
  { label: "Asia/Kolkata — India (UTC+5:30)", value: "Asia/Kolkata" },
  { label: "Asia/Dhaka — Bangladesh (UTC+6)", value: "Asia/Dhaka" },
  { label: "Asia/Bangkok — Indochina (UTC+7)", value: "Asia/Bangkok" },
  { label: "Asia/Singapore — Singapore/HK (UTC+8)", value: "Asia/Singapore" },
  { label: "Asia/Tokyo — Japan (UTC+9)", value: "Asia/Tokyo" },
  { label: "Australia/Adelaide — SA (UTC+9:30/+10:30)", value: "Australia/Adelaide" },
  { label: "Australia/Sydney — AEST (UTC+10/+11)", value: "Australia/Sydney" },
  { label: "Pacific/Auckland — New Zealand (UTC+12/+13)", value: "Pacific/Auckland" },
] as const;

export type TimezoneValue = (typeof TIMEZONES)[number]["value"];

export const VALID_TIMEZONE_VALUES = new Set(TIMEZONES.map((t) => t.value));

export function isValidTimezone(tz: string): tz is TimezoneValue {
  return VALID_TIMEZONE_VALUES.has(tz);
}

export const DIGEST_TIMES = [
  { label: "6:00 AM", value: "06:00:00" },
  { label: "9:00 AM", value: "09:00:00" },
  { label: "12:00 PM", value: "12:00:00" },
  { label: "6:00 PM", value: "18:00:00" },
  { label: "9:00 PM", value: "21:00:00" },
  { label: "12:00 AM", value: "00:00:00" },
] as const;

export type DigestTimeValue = (typeof DIGEST_TIMES)[number]["value"];

export const VALID_DIGEST_TIME_VALUES = new Set(DIGEST_TIMES.map((t) => t.value));

export function isValidDigestTime(t: string): t is DigestTimeValue {
  return VALID_DIGEST_TIME_VALUES.has(t);
}

/**
 * Converts a stored digest_time value ("HH:MM:SS") to a human-readable label
 * like "9:00 PM". Falls back to the raw value if not found in DIGEST_TIMES.
 */
export function formatDigestTime(digestTime: string): string {
  const known = DIGEST_TIMES.find((t) => t.value === digestTime);
  if (known) return known.label;

  // Fallback: parse HH:MM manually
  const [h] = digestTime.slice(0, 5).split(":").map(Number);
  if (isNaN(h)) return digestTime;
  if (h === 0) return "12:00 AM";
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return "12:00 PM";
  return `${h - 12}:00 PM`;
}

/**
 * Returns the IANA timezone value from the browser, falling back to
 * America/New_York if the detected timezone isn't in our supported list.
 * Only safe to call in browser contexts.
 */
export function detectBrowserTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (isValidTimezone(tz)) return tz;
  } catch { /* ignore */ }
  return "America/New_York";
}
