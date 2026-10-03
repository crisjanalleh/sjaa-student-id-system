import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { db } from "@/db";
import { idTemplateConfig } from "@/db/schema";
import { audit } from "@/lib/audit";
import { csrfOk, requireAdminApi } from "@/lib/auth";
import { clientIp } from "@/lib/request";
import { normalizeCardDesign } from "@/lib/card-design";
import { getTemplateConfigForUpdate } from "@/lib/template";
import { cleanText } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

const SCHOOL_YEAR_RE = /^(S\.?Y\.?\s*)?\d{4}\s*[-–]\s*\d{4}$/;

export async function POST(req: Request) {
  const { ctx, error } = await requireAdminApi();
  if (error) return error;
  if (!csrfOk(req, ctx.csrfToken)) return json(403, { ok: false, error: "Security validation failed." });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, error: "Malformed request." });
  }

  const schoolYear = cleanText(body.schoolYear).replace("–", "-").slice(0, 20);
  const orientation =
    body.orientation === "landscape" || body.orientation === "portrait"
      ? body.orientation
      : null;
  const signatoryName = cleanText(body.signatoryName).slice(0, 150);
  const signatoryTitle = cleanText(body.signatoryTitle).slice(0, 150);
  const submittedVersion = body.version;
  if (
    typeof submittedVersion !== "number" ||
    !Number.isSafeInteger(submittedVersion) ||
    submittedVersion < 1
  ) {
    return json(422, { ok: false, error: "Template version is missing. Reload the template page and try again." });
  }
  const designSettingsProvided = Object.prototype.hasOwnProperty.call(body, "designSettings");
  const designRecord =
    typeof body.designSettings === "object" && body.designSettings !== null
      ? (body.designSettings as Record<string, unknown>)
      : null;
  const signatureProvided =
    designRecord !== null &&
    Object.prototype.hasOwnProperty.call(designRecord, "signatorySignature");
  const design = normalizeCardDesign(body.designSettings);
  const rawSignature = signatureProvided ? designRecord.signatorySignature : undefined;
  let signatorySignature: string | null | undefined;
  const errors: Record<string, string> = {};

  if (!SCHOOL_YEAR_RE.test(schoolYear)) {
    errors.schoolYear = "Enter a valid school year (e.g. 2026-2027).";
  }
  if (orientation === null) {
    return json(422, {
      ok: false,
      error: "Choose portrait or landscape card orientation.",
      errors: { orientation: "Choose portrait or landscape card orientation." },
    });
  }
  if (rawSignature !== null && rawSignature !== undefined) {
    if (
      typeof rawSignature !== "string" ||
      rawSignature.length > 1_400_000 ||
      !/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(rawSignature)
    ) {
      return json(422, { ok: false, error: "Upload a valid PNG or JPG signature image under 1 MB." });
    }

    const separator = rawSignature.indexOf(",");
    const bytes = Buffer.from(rawSignature.slice(separator + 1), "base64");
    if (bytes.length === 0 || bytes.length > 1024 * 1024) {
      return json(413, { ok: false, error: "Signature image must be smaller than 1 MB." });
    }
    try {
      const image = sharp(bytes, { limitInputPixels: 4_000_000 });
      const metadata = await image.metadata();
      const expectedFormat = rawSignature.startsWith("data:image/png") ? "png" : "jpeg";
      if (
        metadata.format !== expectedFormat ||
        !metadata.width ||
        !metadata.height ||
        metadata.width < 32 ||
        metadata.height < 12 ||
        metadata.width > 4000 ||
        metadata.height > 2000
      ) {
        return json(422, {
          ok: false,
          error: "Signature must be a genuine PNG or JPG image at least 32×12 pixels.",
        });
      }
      const normalized = await image
        .resize({ width: 640, height: 240, fit: "inside", withoutEnlargement: true })
        .png({ compressionLevel: 9 })
        .toBuffer();
      if (normalized.length > 120_000) {
        return json(422, { ok: false, error: "The processed signature is too large. Crop it more closely or export a smaller transparent PNG." });
      }
      signatorySignature = `data:image/png;base64,${normalized.toString("base64")}`;
    } catch {
      return json(422, { ok: false, error: "The signature image could not be safely processed." });
    }
  }
  if (!signatoryTitle) errors.signatoryTitle = "Signatory title is required.";
  if (Object.keys(errors).length > 0) {
    return json(422, { ok: false, error: "Please correct the highlighted fields.", errors });
  }

  const bool = (v: unknown) => v === true || v === "true";

  const saveResult = await db.transaction(async (tx) => {
    const current = await getTemplateConfigForUpdate(tx);
    if (current.version !== submittedVersion) {
      return { conflict: true as const };
    }
    const nextVersion = current.version + 1;
    const currentDesign = normalizeCardDesign(current.designSettings);
    const nextDesign = designSettingsProvided
      ? {
          ...design,
          signatorySignature: signatureProvided
            ? signatorySignature ?? null
            : currentDesign.signatorySignature,
        }
      : currentDesign;
    await tx
      .update(idTemplateConfig)
      .set({
        schoolYear,
        orientation,
        signatoryName,
        signatoryTitle,
        designSettings: nextDesign,
        showBloodType: bool(body.showBloodType),
        showTrackStrand: bool(body.showTrackStrand),
        showEmergencyContact: bool(body.showEmergencyContact),
        version: nextVersion,
        updatedByAdminId: ctx.admin.id,
        updatedAt: new Date(),
      })
      .where(eq(idTemplateConfig.id, current.id));

    await audit(
      {
        adminId: ctx.admin.id,
        action: "template.updated",
        entityType: "template",
        entityId: current.id,
        metadata: {
          fromVersion: current.version,
          toVersion: nextVersion,
          schoolYear,
          orientation,
          hasSignature: Boolean(nextDesign.signatorySignature),
        },
        ip: clientIp(req),
      },
      tx,
    );
    return {
      conflict: false as const,
      version: nextVersion,
      signature: nextDesign.signatorySignature,
    };
  });

  if (saveResult.conflict) {
    return json(409, {
      ok: false,
      error: "Another administrator saved a newer template. Reload this page to review the latest settings before saving.",
    });
  }
  return json(200, {
    ok: true,
    version: saveResult.version,
    signature: saveResult.signature,
  });
}
