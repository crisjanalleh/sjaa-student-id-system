/** Acknowledgement links stay valid for this long after the email is sent. */
export const ACK_LINK_TTL_HOURS = 72;
const ACK_LINK_TTL_MS = ACK_LINK_TTL_HOURS * 60 * 60 * 1000;

export function acknowledgementExpiresAt(sentAt: Date): Date {
  return new Date(sentAt.getTime() + ACK_LINK_TTL_MS);
}

export function isAcknowledgementExpired(sentAt: Date | null, now = Date.now()): boolean {
  if (!sentAt) return false;
  return acknowledgementExpiresAt(sentAt).getTime() <= now;
}

export function formatAcknowledgementExpiry(expiresAt: Date): string {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(expiresAt);
}
