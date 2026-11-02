// Philippine school years run June to May and are expressed as "2026-2027".
// Everything here is pure so the editor, the ID card and the server agree.

export const AUTO_SCHOOL_YEAR = "auto";

const MANILA_OFFSET_MS = 8 * 3_600_000;
const SCHOOL_YEAR_RE = /^(?:S\.?Y\.?\s*)?(\d{4})\s*[-–]\s*(\d{4})$/i;

/** First calendar year of the school year that is running on the Manila calendar at `now`. */
export function currentSchoolYearStart(now = new Date()): number {
  const manila = new Date(now.getTime() + MANILA_OFFSET_MS);
  const year = manila.getUTCFullYear();
  return manila.getUTCMonth() >= 5 ? year : year - 1;
}

export const formatSchoolYear = (start: number) => `${start}-${start + 1}`;

export const currentSchoolYear = (now = new Date()) => formatSchoolYear(currentSchoolYearStart(now));

/** Returns the normalised "YYYY-YYYY" or null when the text is not a consecutive-year school year. */
export function normalizeSchoolYear(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(SCHOOL_YEAR_RE);
  if (!match) return null;
  const start = Number(match[1]);
  return Number(match[2]) === start + 1 ? formatSchoolYear(start) : null;
}

export const isAutoSchoolYear = (value: unknown) => value === AUTO_SCHOOL_YEAR;

/** The concrete school year to print: "auto" (or anything unreadable) follows the current school year. */
export function resolveSchoolYear(value: unknown, now = new Date()): string {
  return normalizeSchoolYear(value) ?? currentSchoolYear(now);
}

/** Validation boxes on the back of the ID: Senior High has 2, Junior High has 4, starting at the issue year. */
export function validationYearsFor(schoolYear: string, count: number): string[] {
  const start = Number(resolveSchoolYear(schoolYear).slice(0, 4));
  return Array.from({ length: count }, (_, index) => `${start + index} - ${start + index + 1}`);
}

/** Fixed choices offered in the editor: last year up to two years ahead. */
export function schoolYearChoices(now = new Date()): string[] {
  const start = currentSchoolYearStart(now);
  return [start - 1, start, start + 1, start + 2].map(formatSchoolYear);
}
