import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { applicationAccessTokens } from "@/db/schema";
import { encryptAccessToken, randomToken, sha256Hex } from "@/lib/crypto";

export type AccessTokenStatus = "active" | "revoked" | "expired";

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
}): Promise<{ raw: string; id: number }> {
  const raw = randomToken(32);
  const rows = await db
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
