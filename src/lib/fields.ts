export const GRADE_LEVELS = [
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12",
] as const;

export const TRACK_STRANDS = [
  "STEM",
  "HUMSS",
] as const;


export const APPLICATION_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "printed",
  "claimed",
] as const;

export const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  printed: "Printed",
  claimed: "ID Claimed",
};
