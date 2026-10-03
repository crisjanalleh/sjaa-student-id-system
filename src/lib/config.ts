/**
 * Central configuration. Every secret comes from the environment — nothing
 * sensitive is hardcoded. See .env.example for the full contract.
 */

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const DEV_SECRET =
  "dev-only-insecure-secret-set-APP_SECRET-in-production-0123456789abcdef";

const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");

export const config = {
  appUrl,
  appSecret:
    process.env.APP_SECRET && process.env.APP_SECRET.length >= 32
      ? process.env.APP_SECRET
      : DEV_SECRET,
  isDevSecret: !process.env.APP_SECRET || process.env.APP_SECRET.length < 32,
  isProduction: process.env.NODE_ENV === "production",
  trustedProxy: process.env.TRUSTED_PROXY === "true",
  secureCookies: appUrl.startsWith("https://"),
  sessionIdleMinutes: intEnv("SESSION_IDLE_TIMEOUT", 30),
  sessionAbsoluteHours: intEnv("SESSION_ABSOLUTE_TIMEOUT", 12),
  publicTokenDefaultTtlDays: intEnv("PUBLIC_TOKEN_DEFAULT_TTL", 30),
  maxUploadMb: intEnv("MAX_UPLOAD_MB", 5),
  submissionsPerHour: intEnv("RATE_LIMIT_SUBMISSIONS_PER_HOUR", 3),
  setupSecret: process.env.SETUP_SECRET || "",
  privacyNotice:
    process.env.PRIVACY_NOTICE ||
    "The information you provide in this form is collected by San Jose Adventist Academy solely for processing your Student ID application. It is accessed only by authorized school personnel and is not shared with third parties outside the issuance process. For questions about your data, please contact the Administration Office.",
  mail: {
    host: process.env.MAIL_HOST || "",
    port: intEnv("MAIL_PORT", 587),
    username: process.env.MAIL_USERNAME || "",
    password: process.env.MAIL_PASSWORD || "",
    encryption: (process.env.MAIL_ENCRYPTION || "tls").toLowerCase(),
    fromAddress: process.env.MAIL_FROM_ADDRESS || "",
    fromName: process.env.MAIL_FROM_NAME || "San Jose Adventist Academy",
  },
} as const;

export const SCHOOL = {
  name: "San Jose Adventist Academy",
  shortName: "SJAA",
  motto: "The School that Trains for Service.",
  location: "San Jose, Occ. Mindoro",
  established: "1996",
} as const;
