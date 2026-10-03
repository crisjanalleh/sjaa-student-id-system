export const GRADE_LEVELS = [
  "Pre-Kinder",
  "Kindergarten",
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12",
] as const;

export const TRACK_STRANDS = [
  "STEM — Science, Technology, Engineering and Mathematics",
  "ABM — Accountancy, Business and Management",
  "HUMSS — Humanities and Social Sciences",
  "GAS — General Academic Strand",
  "TVL — Technical-Vocational-Livelihood",
] as const;

export const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"] as const;

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
  claimed: "Claimed",
};
