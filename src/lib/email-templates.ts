import "server-only";
import type { StudentApplication } from "@/db/schema";
import { SCHOOL } from "@/lib/config";
import { esc } from "@/lib/format";
import { mailConfigurationError } from "@/lib/mailer-transport";

export type RenderedEmail = { subject: string; text: string; html: string };

function shell(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:'Segoe UI',Arial,sans-serif;color:#1E293B;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:#1B2A4A;color:#FFFFFF;border-radius:6px 6px 0 0;padding:18px 22px;">
      <div style="font-size:17px;font-weight:700;letter-spacing:.2px;">${esc(SCHOOL.name)}</div>
      <div style="font-size:12px;color:#CBD5E1;margin-top:2px;">${esc(SCHOOL.motto)} ${esc(SCHOOL.location)} &middot; Est. ${esc(SCHOOL.established)}</div>
    </div>
    <div style="background:#FFFFFF;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 6px 6px;padding:22px;">
      ${bodyHtml}
    </div>
    <div style="font-size:11px;color:#64748B;padding:14px 4px;line-height:1.5;">
      This is an automated message from the ${esc(SCHOOL.shortName)} Student ID Issuance System.
      Please do not reply to this email. If you did not submit an application, kindly disregard this message.
    </div>
  </div>
</body></html>`;
}

export function rejectionNotice(
  app: Pick<StudentApplication, "applicationCode" | "firstName">,
  reason: string,
): RenderedEmail {
  const subject = `[${SCHOOL.shortName}] Student ID Application — Photo Rejected (${app.applicationCode})`;
  const text = [
    `Dear ${app.firstName},`,
    "",
    "The photo submitted with your Student ID application did not meet the required guidelines and has been rejected.",
    "",
    `Application Control Number: ${app.applicationCode}`,
    `Reason: ${reason}`,
    "",
    "Please visit the Administration Office and bring an acceptable replacement photo (recent, plain background, no filters) so we can continue processing your ID.",
    "",
    `— ${SCHOOL.name}`,
  ].join("\n");
  const body = `
    <p style="margin:0 0 12px;font-size:14px;">Dear <strong>${esc(app.firstName)}</strong>,</p>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">The photo submitted with your Student ID application did not meet the required guidelines and has been <strong style="color:#B91C1C;">rejected</strong>.</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin:0 0 14px;">
      <tr><td style="padding:8px 10px;background:#F1F5F9;border:1px solid #E2E8F0;width:42%;font-weight:600;">Application Control No.</td>
          <td style="padding:8px 10px;border:1px solid #E2E8F0;font-family:Consolas,monospace;">${esc(app.applicationCode)}</td></tr>
      <tr><td style="padding:8px 10px;background:#F1F5F9;border:1px solid #E2E8F0;font-weight:600;">Reason</td>
          <td style="padding:8px 10px;border:1px solid #E2E8F0;">${esc(reason)}</td></tr>
    </table>
    <p style="margin:0 0 4px;font-size:14px;line-height:1.6;">Please visit the <strong>Administration Office</strong> and bring an acceptable replacement photo (recent, plain background, no filters) so we can continue processing your ID.</p>`;
  return { subject, text, html: shell(subject, body) };
}

export function readyForClaiming(
  app: Pick<StudentApplication, "applicationCode" | "firstName">,
): RenderedEmail {
  const subject = `[${SCHOOL.shortName}] Your Student ID is Ready for Claiming (${app.applicationCode})`;
  const text = [
    `Dear ${app.firstName},`,
    "",
    "Your Student ID has been printed and is now ready for claiming.",
    "",
    `Application Control Number: ${app.applicationCode}`,
    "",
    "Please claim your physical ID at the Administration Office during office hours and bring a valid proof of identity.",
    "",
    `— ${SCHOOL.name}`,
  ].join("\n");
  const body = `
    <p style="margin:0 0 12px;font-size:14px;">Dear <strong>${esc(app.firstName)}</strong>,</p>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">Your Student ID has been printed and is now <strong style="color:#15803D;">ready for claiming</strong>.</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin:0 0 14px;">
      <tr><td style="padding:8px 10px;background:#F1F5F9;border:1px solid #E2E8F0;width:42%;font-weight:600;">Application Control No.</td>
          <td style="padding:8px 10px;border:1px solid #E2E8F0;font-family:Consolas,monospace;">${esc(app.applicationCode)}</td></tr>
    </table>
    <p style="margin:0 0 4px;font-size:14px;line-height:1.6;">Please claim your physical ID at the <strong>Administration Office</strong> during office hours and bring a valid proof of identity.</p>`;
  return { subject, text, html: shell(subject, body) };
}

export function renderNotification(
  type: "rejection_notice" | "ready_for_claiming",
  app: Pick<StudentApplication, "applicationCode" | "firstName">,
  context?: { reason?: string | null },
): RenderedEmail {
  if (type === "rejection_notice") {
    return rejectionNotice(app, context?.reason?.trim() || "Photo did not meet the ID guidelines.");
  }
  return readyForClaiming(app);
}

export function mailConfigured(): boolean {
  return mailConfigurationError() === null;
}
