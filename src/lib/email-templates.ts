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
      For questions, contact the Administration Office through the school&rsquo;s usual channels. Do not send sensitive student information by replying to this email.
    </div>
  </div>
</body></html>`;
}

function acknowledgementButton(url: string): string {
  if (!url) return "";
  return `
    <p style="margin:20px 0 8px;font-size:14px;line-height:1.6;">Please confirm that you have received and read this notice. Your confirmation records receipt only; it does not change your application status.</p>
    <p style="margin:0 0 14px;">
      <a href="${esc(url)}" style="display:inline-block;border-radius:6px;padding:11px 18px;background:#1B2A4A;color:#FFFFFF;font-size:14px;font-weight:700;text-decoration:none;">Acknowledge receipt</a>
    </p>
    <p style="margin:0;font-size:11px;line-height:1.5;color:#64748B;">If the button does not open, copy this address into your browser: ${esc(url)}</p>`;
}

export function rejectionNotice(
  app: Pick<StudentApplication, "applicationCode" | "firstName">,
  reason: string,
  acknowledgeUrl = "",
): RenderedEmail {
  const subject = `[${SCHOOL.shortName}] Student ID Application — Photo Rejected (${app.applicationCode})`;
  const text = [
    `Dear ${app.firstName},`,
    "",
    "The Student Services Office has reviewed your Student ID application. The submitted photo does not currently meet the photo requirements, so the application cannot proceed until a replacement photo is provided.",
    "",
    `Application Control Number: ${app.applicationCode}`,
    `Reason: ${reason}`,
    "",
    "What you need to do:",
    "Please visit the Administration Office with a recent, clear replacement photo taken against a plain background. The image should show your face clearly and must not use filters. The office staff can help you replace the photo and return your application for review.",
    "",
    "Please do not submit a second application. Refer to the control number above if you contact the school about this notice.",
    "",
    ...(acknowledgeUrl ? ["Please acknowledge receipt using this secure link:", acknowledgeUrl, "Acknowledging confirms that you received this email; it does not change your application status.", ""] : []),
    "If you believe this notice was sent in error, contact the Administration Office through the school’s usual channels.",
    "",
    `— ${SCHOOL.name}`,
  ].join("\n");
  const body = `
    <p style="margin:0 0 12px;font-size:14px;">Dear <strong>${esc(app.firstName)}</strong>,</p>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.65;">The Student Services Office has reviewed your Student ID application. The submitted photo does not currently meet the photo requirements, so your application cannot proceed until a replacement photo is provided.</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin:0 0 14px;">
      <tr><td style="padding:8px 10px;background:#F1F5F9;border:1px solid #E2E8F0;width:42%;font-weight:600;">Application Control No.</td>
          <td style="padding:8px 10px;border:1px solid #E2E8F0;font-family:Consolas,monospace;">${esc(app.applicationCode)}</td></tr>
      <tr><td style="padding:8px 10px;background:#F1F5F9;border:1px solid #E2E8F0;font-weight:600;">Reason</td>
          <td style="padding:8px 10px;border:1px solid #E2E8F0;">${esc(reason)}</td></tr>
    </table>
    <h2 style="margin:18px 0 6px;font-size:14px;color:#1B2A4A;">What you need to do</h2>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.65;">Please visit the <strong>Administration Office</strong> with a recent, clear replacement photo taken against a plain background. Your face should be clearly visible, and the image should not use filters. Office staff can help replace the photo and return your application for review.</p>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.65;">Please do not submit a second application. Refer to the control number above if you contact the school about this notice. If you believe this message was sent in error, contact the Administration Office through the school&rsquo;s usual channels.</p>
    ${acknowledgementButton(acknowledgeUrl)}
    <p style="margin:16px 0 0;font-size:14px;">Respectfully,<br /><strong>Student Services Office</strong><br />${esc(SCHOOL.name)}</p>`;
  return { subject, text, html: shell(subject, body) };
}

export function readyForClaiming(
  app: Pick<StudentApplication, "applicationCode" | "firstName">,
  acknowledgeUrl = "",
): RenderedEmail {
  const subject = `[${SCHOOL.shortName}] Your Student ID is Ready for Claiming (${app.applicationCode})`;
  const text = [
    `Dear ${app.firstName},`,
    "",
    "We are pleased to inform you that your Student ID card has been prepared and is ready for collection.",
    "",
    `Application Control Number: ${app.applicationCode}`,
    "",
    "Please visit the Administration Office during regular school office hours to collect your physical ID. Bring a valid school identification document or other proof of identity so staff can verify the release. If you are unable to collect it yourself, contact the school in advance to ask about its authorized collection procedure.",
    "",
    "Please quote the application control number above if you contact the school about your card.",
    "",
    ...(acknowledgeUrl ? ["Please acknowledge receipt using this secure link:", acknowledgeUrl, "Acknowledging confirms that you received this email; it does not mark the physical card as collected.", ""] : []),
    "If you believe this message was sent in error, contact the Administration Office through the school’s usual channels.",
    "",
    `— ${SCHOOL.name}`,
  ].join("\n");
  const body = `
    <p style="margin:0 0 12px;font-size:14px;">Dear <strong>${esc(app.firstName)}</strong>,</p>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.65;">We are pleased to inform you that your Student ID card has been prepared and is <strong style="color:#15803D;">ready for collection</strong>.</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin:0 0 14px;">
      <tr><td style="padding:8px 10px;background:#F1F5F9;border:1px solid #E2E8F0;width:42%;font-weight:600;">Application Control No.</td>
          <td style="padding:8px 10px;border:1px solid #E2E8F0;font-family:Consolas,monospace;">${esc(app.applicationCode)}</td></tr>
    </table>
    <h2 style="margin:18px 0 6px;font-size:14px;color:#1B2A4A;">Collection instructions</h2>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.65;">Please visit the <strong>Administration Office</strong> during regular school office hours to collect your physical ID. Bring a valid school identification document or other proof of identity so staff can verify the release. If you cannot collect it yourself, contact the school in advance to ask about its authorized collection procedure.</p>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.65;">Please quote the application control number above if you contact the school about your card. This email confirms that the card is ready; it does not mean that the card has already been collected.</p>
    ${acknowledgementButton(acknowledgeUrl)}
    <p style="margin:16px 0 0;font-size:14px;">Respectfully,<br /><strong>Student Services Office</strong><br />${esc(SCHOOL.name)}</p>`;
  return { subject, text, html: shell(subject, body) };
}

export function renderNotification(
  type: "rejection_notice" | "ready_for_claiming",
  app: Pick<StudentApplication, "applicationCode" | "firstName">,
  context?: { reason?: string | null; acknowledgeUrl?: string },
): RenderedEmail {
  if (type === "rejection_notice") {
    return rejectionNotice(
      app,
      context?.reason?.trim() || "Photo did not meet the ID guidelines.",
      context?.acknowledgeUrl,
    );
  }
  return readyForClaiming(app, context?.acknowledgeUrl);
}

export function mailConfigured(): boolean {
  return mailConfigurationError() === null;
}
