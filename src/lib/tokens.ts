import "server-only";
import { randomInt } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { applicationAccessTokens } from "@/db/schema";
import { encryptAccessToken, sha256Hex } from "@/lib/crypto";
import { getPublicBaseUrl } from "@/lib/public-url";

type Executor = Pick<typeof db, "insert">;

export type AccessTokenStatus = "active" | "revoked" | "expired";

// Unambiguous lowercase alphabet (no 0/o, 1/l/i) so links are easy to read aloud and type.
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const LEGACY_PREFIX = "sjaa-";

/**
 * Readable access token such as `sjaa-sy-2026-2027-k7m3x9q2d8v4h6pa`:
 * a recognisable school prefix, the campaign name and 16 random characters
 * (about 79 bits of entropy, validated by SHA-256 hash like any other token).
 */
export function friendlyToken(label: string): string {
  const slug = label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24)
    .replace(/-+$/g, "");
  let code = "";
  for (let i = 0; i < 16; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `${LEGACY_PREFIX}${slug ? `${slug}-` : ""}${code}`;
}

/** Public link for a stored token. Older random tokens keep their original query-string form. */
export function accessLinkFor(raw: string): string {
  const base = getPublicBaseUrl();
  return raw.startsWith(LEGACY_PREFIX) ? `${base}/apply/${raw}` : `${base}/?access_token=${raw}`;
}

export async function validateAccessToken(raw: string) {
  if (!raw || raw.length < 20 || raw.length > 200) return null;
  const rows = await db
    .select()
    .from(applicationAccessTokens)
    .where(eq(applicationAccessTokens.tokenHash, sha256Hex(raw)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.revokedAt) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;
  return row;
}

export async function markTokenUsed(tokenId: number): Promise<void> {
  await db
    .update(applicationAccessTokens)
    .set({
      useCount: sql`${applicationAccessTokens.useCount} + 1`,
      lastUsedAt: new Date(),
    })
    .where(eq(applicationAccessTokens.id, tokenId));
}

export async function createAccessToken(opts: {
  label: string;
  expiresAt: Date | null;
  createdByAdminId: number;
}, executor: Executor = db): Promise<{ raw: string; id: number }> {
  const raw = friendlyToken(opts.label);
  const rows = await executor
    .insert(applicationAccessTokens)
    .values({
      tokenHash: sha256Hex(raw),
      tokenCiphertext: encryptAccessToken(raw),
      label: opts.label,
      expiresAt: opts.expiresAt,
      createdByAdminId: opts.createdByAdminId,
    })
    .$returningId();
  return { raw, id: rows[0].id };
}

export function tokenStatus(row: {
  revokedAt: Date | null;
  expiresAt: Date | null;
}): AccessTokenStatus {
  if (row.revokedAt) return "revoked";
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return "expired";
  return "active";
}
