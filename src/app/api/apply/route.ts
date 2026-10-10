import { and, eq, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { studentApplications } from "@/db/schema";
import { audit } from "@/lib/audit";
import { config } from "@/lib/config";
import { hashIp, newApplicationCode } from "@/lib/crypto";
import { csrfOk, getFormContext } from "@/lib/auth";
import { PhotoError, deletePhoto, processStudentPhoto } from "@/lib/photos";
import { cleanupRateLimits, rateLimitHit, rateLimitPeek } from "@/lib/rate-limit";
import {
  clientIp,
  readFormDataBounded,
  RequestBodyTooLargeError,
} from "@/lib/request";
import { hasErrors, validateApplicationFields } from "@/lib/validate";
import { duplicateEntryMessage, isDuplicateEntry } from "@/lib/db-errors";
import { formatDateTime } from "@/lib/format";
import { processStudentSignature, StudentSignatureError } from "@/lib/student-signature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DUPLICATE_MESSAGE =
  "Some details have already been submitted. Review the highlighted fields; if you believe this is an error, contact the administration office.";

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  const ipHash = hashIp(ip);

  // Early size rejection before parsing the multipart body.
  const contentLength = Number(req.headers.get("content-length") || 0);
  const hardLimit = (config.maxUploadMb + 2) * 1024 * 1024;
  if (contentLength > hardLimit) {
    return json(413, { ok: false, error: `The request is too large. Photo files must be no larger than ${config.maxUploadMb} MB.` });
  }

  // 1. A valid form session (from a distributed QR token) is mandatory.
  const ctx = await getFormContext();
  if (!ctx) {
    return json(403, {
      ok: false,
      error: "Your application session has expired. Please scan the official QR code or open the distributed link again.",
    });
  }

  // 2. CSRF bound to the server-side form session.
  if (!csrfOk(req, ctx.csrfToken)) {
    return json(403, { ok: false, error: "Security validation failed. Please reload the page and try again." });
  }

  // 3. Rate limits: per-IP submission quota + per-token quota.
  const ipLimit = await rateLimitHit(`sub:ip:${ipHash}`, config.submissionsPerHour, 3600);
  if (!ipLimit.allowed) {
    return json(429, {
      ok: false,
      error: `Submission limit reached. You can submit up to ${config.submissionsPerHour} applications per hour from this connection. Please try again later.`,
    });
  }
  const tokenLimit = await rateLimitHit(`sub:tok:${ctx.accessTokenId}`, 60, 3600);
  if (!tokenLimit.allowed) {
    return json(429, {
      ok: false,
      error: "This application link is temporarily rate-limited. Please try again later.",
    });
  }
  void cleanupRateLimits().catch((err: unknown) => {
    console.error(
      "Rate-limit cleanup failed:",
      err instanceof Error ? err.message : err,
    );
  });

  // Abusive-client bucket: repeated malformed requests are throttled harder.
  // Peek first (no increment); increments happen only on actual failures.
  const failedAttempts = await rateLimitPeek(`suberr:ip:${ipHash}`, 3600);
  if (failedAttempts.count >= 20) {
    return json(429, { ok: false, error: "Too many invalid requests. Please try again later." });
  }
  const countFailure = () => rateLimitHit(`suberr:ip:${ipHash}`, 20, 3600);

  let formData: FormData;
  try {
    formData = await readFormDataBounded(req, hardLimit);
  } catch (err) {
    await countFailure();
    if (err instanceof RequestBodyTooLargeError) {
      return json(413, { ok: false, error: `The request is too large. Photo files must be no larger than ${config.maxUploadMb} MB.` });
    }
    return json(400, { ok: false, error: "Malformed request." });
  }

  // 4. Server-side validation (client checks are never trusted).
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") raw[key] = value;
  }
  const { values, errors } = validateApplicationFields(raw);
  if (hasErrors(errors)) {
    await countFailure();
    return json(422, { ok: false, error: "Please correct the highlighted fields.", errors });
  }

  // 5. UX pre-check complements the unique database indexes; return only which
  // submitted fields conflict, never details from the existing application.
  const dupeConditions = [
    eq(studentApplications.studentIdNumber, values.studentIdNumber),
    eq(studentApplications.email, values.email ?? ""),
  ];
  const existing = await db
    .select({
      studentIdNumber: studentApplications.studentIdNumber,
      firstName: studentApplications.firstName,
      middleName: studentApplications.middleName,
      lastName: studentApplications.lastName,
      suffix: studentApplications.suffix,
      email: studentApplications.email,
    })
    .from(studentApplications)
    .where(and(isNull(studentApplications.deletedAt), or(...dupeConditions)))
    .limit(2);
  if (existing.length > 0) {
    const duplicateErrors: Record<string, string> = {};
    const name = (part: string | null | undefined) => (part ?? "").trim().toLowerCase();
    for (const match of existing) {
      let thisMatchIsDuplicate = false;
      if (match.studentIdNumber.toLowerCase() === values.studentIdNumber.toLowerCase()) {
        duplicateErrors.studentIdNumber = "This Student ID / LRN has already been submitted.";
        thisMatchIsDuplicate = true;
      }
      if (match.email?.toLowerCase() === values.email?.toLowerCase()) {
        duplicateErrors.email = "This email address has already been used for an application.";
        thisMatchIsDuplicate = true;
      }
      if (
        thisMatchIsDuplicate &&
        name(match.firstName) === name(values.firstName) &&
        name(match.middleName) === name(values.middleName) &&
        name(match.lastName) === name(values.lastName) &&
        name(match.suffix) === name(values.suffix)
      ) {
        duplicateErrors.firstName = "This name is already included in the matching submitted application.";
        duplicateErrors.lastName = "This name is already included in the matching submitted application.";
      }
    }
    await countFailure();
    return json(409, { ok: false, error: DUPLICATE_MESSAGE, errors: duplicateErrors });
  }

  // 6. The student signature is required and normalized as a transparent PNG.
  const signatureValue = formData.get("studentSignature");
  if (
    typeof signatureValue !== "string" ||
    signatureValue.length > 410_000 ||
    !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(signatureValue)
  ) {
    await countFailure();
    return json(422, {
      ok: false,
      error: "",
      errors: { studentSignature: "Draw your signature in the signature pad before submitting." },
    });
  }
  let studentSignatureDataUrl: string;
  try {
    studentSignatureDataUrl = await processStudentSignature(
      Buffer.from(signatureValue.slice(signatureValue.indexOf(",") + 1), "base64"),
    );
  } catch (err) {
    await countFailure();
    return json(422, {
      ok: false,
      error: "",
      errors: {
        studentSignature:
          err instanceof StudentSignatureError
            ? err.message
            : "The signature could not be processed. Please sign again.",
      },
    });
  }

  // 7. Secure photo pipeline (required for the student ID).
  let photoKey: string | null = null;
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return json(422, { ok: false, error: "", errors: { photo: "An ID photo is required to submit your application." } });
  } else {
    if (photo.size > config.maxUploadMb * 1024 * 1024) {
      return json(413, {
        ok: false,
        error: "",
        errors: { photo: `Photo exceeds the ${config.maxUploadMb} MB limit.` },
      });
    }
    try {
      const buffer = Buffer.from(await photo.arrayBuffer());
      const processed = await processStudentPhoto({ buffer, byteLength: buffer.length });
      photoKey = processed.storageKey;
    } catch (err) {
      if (err instanceof PhotoError) {
        return json(err.status, { ok: false, error: "", errors: { photo: err.message } });
      }
      return json(422, { ok: false, error: "", errors: { photo: "The photo could not be processed." } });
    }
  }

  // 8. Insert with collision-retried control number inside enforced uniqueness.
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = newApplicationCode();
    const submittedAt = new Date();
    try {
      await db.transaction(async (tx) => {
        await tx.insert(studentApplications).values({
          applicationCode: code,
          studentIdNumber: values.studentIdNumber,
          firstName: values.firstName,
          middleName: values.middleName,
          lastName: values.lastName,
          suffix: values.suffix,
          address: values.address,
          gradeLevel: values.gradeLevel,
          trackStrand: values.trackStrand,
          email: values.email,
          contactNumber: values.contactNumber,
          emergencyContactName: values.emergencyContactName,
          emergencyContactPhone: values.emergencyContactPhone,
          photoStorageKey: photoKey,
          studentSignatureDataUrl,
          accessTokenId: ctx.accessTokenId,
          status: "pending",
          createdAt: submittedAt,
          updatedAt: submittedAt,
        });

        await audit({
          action: "application.submitted",
          entityType: "application",
          entityId: code,
          metadata: { gradeLevel: values.gradeLevel, hasPhoto: Boolean(photoKey) },
          ip,
        }, tx);
      });

      return json(201, {
        ok: true,
        applicationCode: code,
        submittedAt: formatDateTime(submittedAt),
      });
    } catch (err) {
      if (
        isDuplicateEntry(err) &&
        duplicateEntryMessage(err).includes("student_applications_code_uq")
      ) {
        continue; // control-number collision — regenerate and retry
      }
      if (isDuplicateEntry(err)) {
        await deletePhoto(photoKey);
        const message = duplicateEntryMessage(err);
        const duplicateErrors: Record<string, string> = {};
        if (message.includes("student_applications_student_no_uq")) {
          duplicateErrors.studentIdNumber = "This Student ID / LRN has already been submitted.";
        }
        if (message.includes("student_applications_email_uq")) {
          duplicateErrors.email = "This email address has already been used for an application.";
        }
        return json(409, {
          ok: false,
          error: DUPLICATE_MESSAGE,
          ...(Object.keys(duplicateErrors).length ? { errors: duplicateErrors } : {}),
        });
      }
      await deletePhoto(photoKey);
      throw err; // unexpected — handled by the platform error layer (no details leaked)
    }
  }

  await deletePhoto(photoKey);
  return json(500, { ok: false, error: "Could not allocate a control number. Please try again." });
}
