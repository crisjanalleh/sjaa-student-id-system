type AuditPresentation = {
  label: string;
  color: string;
  background: string;
  border: string;
};

const PRESENTATION: Record<string, AuditPresentation> = {
  "admin.setup_completed": { label: "Administrator setup completed", color: "#166534", background: "#dcfce7", border: "#bbf7d0" },
  "admin.school_location_updated": { label: "School location updated", color: "#1e40af", background: "#dbeafe", border: "#bfdbfe" },
  "admin.profile_updated": { label: "Administrator profile updated", color: "#1e40af", background: "#dbeafe", border: "#bfdbfe" },
  "auth.login_success": { label: "Signed in", color: "#166534", background: "#dcfce7", border: "#bbf7d0" },
  "auth.login_failed": { label: "Sign-in failed", color: "#991b1b", background: "#fee2e2", border: "#fecaca" },
  "auth.logout": { label: "Signed out", color: "#475569", background: "#f1f5f9", border: "#cbd5e1" },
  "auth.session_expired": { label: "Session expired", color: "#92400e", background: "#fef3c7", border: "#fde68a" },
  "token.created": { label: "Application link created", color: "#1e40af", background: "#dbeafe", border: "#bfdbfe" },
  "token.revoked": { label: "Application link deactivated", color: "#9f1239", background: "#ffe4e6", border: "#fecdd3" },
  "token.regenerated": { label: "Application link renewed", color: "#6b21a8", background: "#f3e8ff", border: "#e9d5ff" },
  "token.revealed": { label: "Application link viewed", color: "#0e7490", background: "#cffafe", border: "#a5f3fc" },
  "application.submitted": { label: "Application submitted", color: "#0e7490", background: "#cffafe", border: "#a5f3fc" },
  "application.edited": { label: "Application details updated", color: "#4338ca", background: "#e0e7ff", border: "#c7d2fe" },
  "application.approved": { label: "Application approved", color: "#166534", background: "#dcfce7", border: "#bbf7d0" },
  "application.rejected": { label: "Application not approved", color: "#991b1b", background: "#fee2e2", border: "#fecaca" },
  "application.photo_replaced": { label: "Student photo replaced", color: "#7e22ce", background: "#f3e8ff", border: "#e9d5ff" },
  "application.deleted": { label: "Application archived", color: "#9f1239", background: "#ffe4e6", border: "#fecdd3" },
  "application.claimed": { label: "ID card claimed", color: "#0f766e", background: "#ccfbf1", border: "#99f6e4" },
  "template.updated": { label: "ID card design updated", color: "#6b21a8", background: "#f3e8ff", border: "#e9d5ff" },
  "batch.created": { label: "ID print batch created", color: "#1e40af", background: "#dbeafe", border: "#bfdbfe" },
  "batch.printed": { label: "ID cards printed and ready", color: "#166534", background: "#dcfce7", border: "#bbf7d0" },
  "notification.queued": { label: "Email notification queued", color: "#92400e", background: "#fef3c7", border: "#fde68a" },
  "notification.retried": { label: "Email notification retried", color: "#0e7490", background: "#cffafe", border: "#a5f3fc" },
  "notification.acknowledged": { label: "Email receipt acknowledged", color: "#166534", background: "#dcfce7", border: "#bbf7d0" },
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

export function auditActionStyle(action: string): AuditPresentation {
  return PRESENTATION[action] ?? {
    label: labelForUnknownAction(action),
    color: "#475569",
    background: "#f1f5f9",
    border: "#cbd5e1",
  };
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
