import { and, eq, ne, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { db } from "@/db";
import { adminProfiles, adminSessions, adminUsers } from "@/db/schema";
import { audit } from "@/lib/audit";
import { csrfOk, requireAdminApi } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import {
  clientIp,
  readJsonObjectBounded,
  RequestBodyTooLargeError,
} from "@/lib/request";
import { cleanText } from "@/lib/validate";
import { isDuplicateEntry } from "@/lib/db-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function response(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const { ctx, error } = await requireAdminApi();
  if (error) return error;
  if (!csrfOk(req, ctx.csrfToken)) return response(403, { ok: false, error: "Security validation failed." });
  let body: Record<string, unknown>;
  try {
    body = await readJsonObjectBounded(req, 2 * 1024 * 1024);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return response(413, { ok: false, error: "Profile update is too large. Profile images must be 1 MB or smaller." });
    }
    return response(400, { ok: false, error: "Could not read the profile update." });
  }

  const fullName = cleanText(body.fullName).slice(0, 150);
  const username = cleanText(body.username).slice(0, 64);
  const email = cleanText(body.email).toLowerCase().slice(0, 255);
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword.slice(0, 128) : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword.slice(0, 128) : "";
  const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword.slice(0, 128) : "";
  if (fullName.length < 2) return response(422, { ok: false, field: "fullName", error: "Enter your full name." });
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{2,63}$/.test(username)) {
    return response(422, { ok: false, field: "username", error: "Username must be 3–64 characters and use only letters, numbers, dots, underscores, or hyphens." });
  }
  if (!/^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(email)) {
    return response(422, { ok: false, field: "email", error: "Enter a valid email address." });
  }
  if (!currentPassword || !verifyPassword(currentPassword, ctx.admin.passwordHash)) {
    return response(403, { ok: false, field: "currentPassword", error: "The current password is incorrect." });
  }
  if (newPassword && newPassword.length < 12) {
    return response(422, { ok: false, field: "newPassword", error: "Use at least 12 characters for the new password." });
  }
  if (newPassword && newPassword !== confirmPassword) {
    return response(422, { ok: false, field: "confirmPassword", error: "The password confirmation does not match." });
  }
  if (!newPassword && confirmPassword) {
    return response(422, { ok: false, field: "confirmPassword", error: "Enter a new password before confirming it." });
  }

  const duplicate = await db
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(and(ne(adminUsers.id, ctx.admin.id), or(eq(adminUsers.email, email), eq(adminUsers.username, username))))
    .limit(1);
  if (duplicate.length) {
    const [existing] = await db.select({ email: adminUsers.email }).from(adminUsers).where(eq(adminUsers.id, duplicate[0].id)).limit(1);
    const isEmail = existing?.email.toLowerCase() === email;
    return response(409, {
      ok: false,
      field: isEmail ? "email" : "username",
      error: isEmail ? "That email address is already used by another administrator." : "That username is already in use.",
    });
  }

  let avatarDataUrl: string | null = null;
  if (body.avatarDataUrl !== null && body.avatarDataUrl !== undefined) {
    if (
      typeof body.avatarDataUrl !== "string" ||
      body.avatarDataUrl.length > 1_400_000 ||
      !/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(body.avatarDataUrl)
    ) {
      return response(422, { ok: false, field: "avatar", error: "Choose a valid PNG or JPG profile photo under 1 MB." });
    }
    const bytes = Buffer.from(body.avatarDataUrl.slice(body.avatarDataUrl.indexOf(",") + 1), "base64");
    if (!bytes.length || bytes.length > 1024 * 1024) {
      return response(413, { ok: false, field: "avatar", error: "Profile photo must be 1 MB or smaller." });
    }
    try {
      const source = sharp(bytes, { limitInputPixels: 4_000_000 });
      const metadata = await source.metadata();
      const expectedFormat = body.avatarDataUrl.startsWith("data:image/png") ? "png" : "jpeg";
      if (metadata.format !== expectedFormat || !metadata.width || !metadata.height) {
        return response(422, { ok: false, field: "avatar", error: "The selected file is not a valid PNG or JPG image." });
      }
      const normalized = await source
        .resize(256, 256, { fit: "cover", position: "attention" })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer();
      if (normalized.length > 60_000) {
        return response(422, { ok: false, field: "avatar", error: "The profile photo could not be reduced to a safe size." });
      }
      avatarDataUrl = `data:image/jpeg;base64,${normalized.toString("base64")}`;
    } catch {
      return response(422, { ok: false, field: "avatar", error: "The profile photo could not be safely processed." });
    }
  }

  const passwordChanged = Boolean(newPassword);
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(adminUsers)
        .set({
          fullName,
          username,
          email,
          ...(passwordChanged ? { passwordHash: hashPassword(newPassword) } : {}),
          updatedAt: new Date(),
        })
        .where(eq(adminUsers.id, ctx.admin.id));
      await tx
        .insert(adminProfiles)
        .values({ adminUserId: ctx.admin.id, avatarDataUrl, updatedAt: new Date() })
        .onDuplicateKeyUpdate({ set: { avatarDataUrl, updatedAt: new Date() } });
      if (passwordChanged) {
        await tx
          .delete(adminSessions)
          .where(and(eq(adminSessions.adminUserId, ctx.admin.id), ne(adminSessions.id, ctx.sessionId)));
      }
      await audit(
        {
          adminId: ctx.admin.id,
          action: "admin.profile_updated",
          entityType: "admin",
          entityId: ctx.admin.id,
          metadata: { passwordChanged, hasProfilePhoto: Boolean(avatarDataUrl) },
          ip: clientIp(req),
        },
        tx,
      );
    });
  } catch (err) {
    if (isDuplicateEntry(err)) {
      return response(409, { ok: false, error: "The username or email address is already in use. Refresh the profile and try again." });
    }
    throw err;
  }

  return response(200, { ok: true, fullName, username, email, passwordChanged });
}
