export type HealthLevel = "healthy" | "warning" | "error";

/** What the admin can do about a problem: replace the link, or just test again after fixing the network. */
export type HealthFix = "regenerate" | "recheck" | null;

export type HealthIssue = {
  code: string;
  level: Exclude<HealthLevel, "healthy">;
  title: string;
  detail: string;
  fix: HealthFix;
};

export type TokenHealth = {
  id: number;
  level: HealthLevel;
  issues: HealthIssue[];
  /** The single best action for the whole token. "regenerate" wins over "recheck". */
  fix: HealthFix;
  checkedAt: string;
};
