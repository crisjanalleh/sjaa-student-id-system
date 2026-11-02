import "server-only";
import { decryptAccessToken, safeEqual, sha256Hex } from "@/lib/crypto";
import { getPublicBaseUrl, isPublicBaseUrlLocal } from "@/lib/public-url";
import { validateAccessToken } from "@/lib/tokens";
import type { HealthFix, HealthIssue, TokenHealth } from "@/lib/token-health-types";

type TokenRow = {
  id: number;
  tokenHash: string;
  tokenCiphertext: string | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
};

const PROBE_CACHE_MS = 20_000;
const PROBE_TIMEOUT_MS = 5_000;
const probeState = globalThis as typeof globalThis & { __sjaaProbe?: { at: number; base: string; result: HealthIssue | null } };

/** Is the public address answering? Cached briefly so many tokens share one probe. */
async function probePublicAddress(fresh: boolean): Promise<HealthIssue | null> {
  const base = getPublicBaseUrl();
  if (isPublicBaseUrlLocal()) {
    return {
      code: "local-only",
      level: "warning",
      title: "Link only works on this computer",
      detail:
        "The public address is not set, so phones and other networks cannot open this link. Start the public tunnel (npm run share) or set APP_URL, then recheck.",
      fix: "recheck",
    };
  }
  const cached = probeState.__sjaaProbe;
  if (!fresh && cached && cached.base === base && Date.now() - cached.at < PROBE_CACHE_MS) return cached.result;

  let result: HealthIssue | null = null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(`${base}/api/health`, { cache: "no-store", signal: controller.signal, redirect: "manual" });
    if (!response.ok) {
      result = {
        code: "address-error",
        level: "error",
        title: "The public address answers with an error",
        detail: `The address ${new URL(base).host} responded with status ${response.status}. Students may see an error page. Check that the server and tunnel are running, then recheck.`,
        fix: "recheck",
      };
    }
  } catch {
    result = {
      code: "address-unreachable",
      level: "error",
      title: "The public address is not reachable",
      detail: `Nothing answered at ${new URL(base).host}. The tunnel or internet connection may have stopped, so students cannot open this link even though it is still active. Restart the public tunnel (npm run share) and recheck.`,
      fix: "recheck",
    };
  } finally {
    clearTimeout(timer);
  }
  probeState.__sjaaProbe = { at: Date.now(), base, result };
  return result;
}

function bestFix(issues: HealthIssue[]): HealthFix {
  if (issues.some((issue) => issue.fix === "regenerate")) return "regenerate";
  if (issues.some((issue) => issue.fix === "recheck")) return "recheck";
  return null;
}

async function checkOne(row: TokenRow, addressIssue: HealthIssue | null, now: number): Promise<TokenHealth> {
  const issues: HealthIssue[] = [];

  if (row.revokedAt) {
    issues.push({ code: "revoked", level: "error", title: "Link was revoked", detail: "Students can no longer use it. Regenerate to issue a new one.", fix: "regenerate" });
  } else if (row.expiresAt && row.expiresAt.getTime() <= now) {
    issues.push({ code: "expired", level: "error", title: "Link has expired", detail: "Students can no longer use it. Regenerate to issue a new one.", fix: "regenerate" });
  } else {
    if (!row.tokenCiphertext) {
      issues.push({
        code: "not-recoverable",
        level: "error",
        title: "Link cannot be recovered",
        detail: "This link was created before secure recovery existed, so it cannot be shown or shared again. Regenerate to get a shareable replacement.",
        fix: "regenerate",
      });
    } else {
      const raw = decryptAccessToken(row.tokenCiphertext);
      if (!raw || !safeEqual(sha256Hex(raw), row.tokenHash)) {
        issues.push({
          code: "integrity",
          level: "error",
          title: "Saved link is damaged",
          detail: "The stored link no longer matches its record (the system secret may have changed). Regenerate to create a working link.",
          fix: "regenerate",
        });
      } else {
        // Same lookup a student's phone triggers when they scan the QR code.
        const entry = await validateAccessToken(raw).catch(() => "db-error" as const);
        if (entry === "db-error") {
          issues.push({ code: "database", level: "error", title: "Database not answering", detail: "The check could not reach the database, so students may not be able to open the form. Recheck in a moment.", fix: "recheck" });
        } else if (!entry) {
          issues.push({ code: "entry-rejected", level: "error", title: "Students would be turned away", detail: "The form rejects this link even though it looks active. Regenerate to create a fresh one.", fix: "regenerate" });
        }
        if (!/^[A-Za-z0-9_-]{16,200}$/.test(raw)) {
          issues.push({ code: "format", level: "error", title: "Link format not accepted", detail: "The link contains characters the entry page refuses. Regenerate to create a valid one.", fix: "regenerate" });
        }
      }
    }

    if (row.expiresAt) {
      const hours = (row.expiresAt.getTime() - now) / 3_600_000;
      if (hours > 0 && hours <= 48) {
        issues.push({
          code: "expiring",
          level: "warning",
          title: hours < 1 ? "Expires within the hour" : `Expires in ${Math.floor(hours)} hour${Math.floor(hours) === 1 ? "" : "s"}`,
          detail: "Regenerate before it ends if students still need access. Regenerating replaces the current link.",
          fix: null,
        });
      }
    }
    if (addressIssue) issues.push(addressIssue);
  }

  const level = issues.some((issue) => issue.level === "error") ? "error" : issues.length ? "warning" : "healthy";
  return { id: row.id, level, issues, fix: bestFix(issues), checkedAt: new Date(now).toISOString() };
}

export async function checkTokenHealth(rows: TokenRow[], fresh = false): Promise<TokenHealth[]> {
  const now = Date.now();
  const addressIssue = rows.some((row) => !row.revokedAt && (!row.expiresAt || row.expiresAt.getTime() > now))
    ? await probePublicAddress(fresh)
    : null;
  return Promise.all(rows.map((row) => checkOne(row, addressIssue, now)));
}
