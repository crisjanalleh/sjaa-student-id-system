export type AuditTone = "approved" | "pending" | "rejected" | "printed" | "claimed" | "neutral";

type AuditPresentation = {
  label: string;
  tone: AuditTone;
};

// Tones map onto the theme-aware semantic badge classes (see globals.css),
// so activity colours stay muted and legible in every light/dark theme.
const PRESENTATION: Record<string, AuditPresentation> = {
  "admin.setup_completed": { label: "Administrator setup completed", tone: "claimed" },
  "admin.school_location_updated": { label: "School location updated", tone: "approved" },
  "admin.profile_updated": { label: "Administrator profile updated", tone: "approved" },
  "auth.login_success": { label: "Signed in", tone: "claimed" },
  "auth.login_failed": { label: "Sign-in failed", tone: "rejected" },
  "auth.logout": { label: "Signed out", tone: "neutral" },
  "auth.session_expired": { label: "Session expired", tone: "pending" },
  "token.created": { label: "Application link created", tone: "approved" },
  "token.revoked": { label: "Application link deactivated", tone: "rejected" },
  "token.regenerated": { label: "Application link renewed", tone: "printed" },
  "token.revealed": { label: "Application link viewed", tone: "approved" },
  "application.submitted": { label: "Application submitted", tone: "approved" },
  "application.edited": { label: "Application details updated", tone: "printed" },
  "application.approved": { label: "Application approved", tone: "claimed" },
  "application.rejected": { label: "Application not approved", tone: "rejected" },
  "application.photo_replaced": { label: "Student photo replaced", tone: "printed" },
  "application.deleted": { label: "Application archived", tone: "rejected" },
  "application.claimed": { label: "ID card claimed", tone: "claimed" },
  "template.updated": { label: "ID card design updated", tone: "printed" },
  "batch.created": { label: "ID print batch created", tone: "approved" },
  "batch.printed": { label: "ID cards printed and ready", tone: "claimed" },
  "notification.queued": { label: "Email notification queued", tone: "pending" },
  "notification.retried": { label: "Email notification retried", tone: "approved" },
  "notification.acknowledged": { label: "Email receipt acknowledged", tone: "claimed" },
};

type AuditMetadata = Record<string, unknown> | null | undefined;

function textValue(metadata: AuditMetadata, key: string): string {
  const value = metadata?.[key];
  return typeof value === "string" || typeof value === "number" ? String(value).slice(0, 160) : "";
}

function labelForUnknownAction(action: string): string {
  return action
    .split(/[._]/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

export function auditActionLabel(action: string): string {
  return PRESENTATION[action]?.label ?? labelForUnknownAction(action);
}

export function auditActionTone(action: string): AuditTone {
  return PRESENTATION[action]?.tone ?? "neutral";
}

export function auditDetails(action: string, metadata: AuditMetadata): string {
  const label = textValue(metadata, "label");
  const code = textValue(metadata, "code");
  const reason = textValue(metadata, "reason");

  switch (action) {
    case "admin.setup_completed":
      return "Initial administrator account created";
    case "admin.profile_updated":
      return metadata?.passwordChanged === true ? "Profile details and sign-in password updated" : "Administrator profile details updated";
    case "admin.school_location_updated":
      return textValue(metadata, "address") ? `School location set to ${textValue(metadata, "address")}` : "School location updated";
    case "auth.login_failed": {
      const username = textValue(metadata, "username");
      return username ? `Sign-in attempted for ${username}` : "Unsuccessful sign-in attempt";
    }
    case "token.created":
      return label ? `Link: ${label}` : "New application link is ready";
    case "token.revoked":
      return label ? `Deactivated link: ${label}` : "Application link deactivated";
    case "token.regenerated":
      return label ? `Renewed link: ${label}` : "Application link renewed";
    case "token.revealed":
      return label ? `Viewed link: ${label}` : "Application link viewed";
    case "application.submitted": {
      const grade = textValue(metadata, "gradeLevel");
      return [grade, "Awaiting review"].filter(Boolean).join(" · ");
    }
    case "application.approved":
    case "application.claimed":
    case "application.edited":
    case "application.deleted":
      return code ? `Control number ${code}` : auditActionLabel(action);
    case "application.rejected":
      return reason ? `Reason: ${reason}` : code ? `Control number ${code}` : "Application not approved";
    case "application.photo_replaced": {
      const previousReason = textValue(metadata, "previousReason");
      return previousReason ? `Previous rejection reason: ${previousReason}` : "Replacement photo saved";
    }
    case "template.updated": {
      const schoolYear = textValue(metadata, "schoolYear");
      const orientation = textValue(metadata, "orientation");
      return [schoolYear && `School year ${schoolYear}`, orientation && `${orientation} layout`]
        .filter(Boolean)
        .join(" · ") || "Card design settings saved";
    }
    case "batch.created": {
      const count = textValue(metadata, "cardCount");
      const batchCode = textValue(metadata, "batchCode");
      return [count && `${count} ${count === "1" ? "card" : "cards"}`, batchCode && `Batch ${batchCode}`]
        .filter(Boolean)
        .join(" · ") || "Cards added to a print batch";
    }
    case "batch.printed": {
      const count = textValue(metadata, "cardCount");
      const batchCode = textValue(metadata, "batchCode");
      return [count && `${count} ${count === "1" ? "card" : "cards"}`, batchCode && `Batch ${batchCode}`]
        .filter(Boolean)
        .join(" · ") || "Batch confirmed as printed";
    }
    case "notification.retried": {
      const result = textValue(metadata, "result");
      return result === "sent" ? "Email delivered after retry" : result === "failed" ? "Retry did not deliver the email" : "Delivery retry attempted";
    }
    case "notification.queued":
      return "Email added to the delivery queue";
    case "notification.acknowledged":
      return "Recipient confirmed receipt of the email";
    default:
      return "";
  }
}
