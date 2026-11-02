// Shared by the student form (live feedback) and the server (final authority).

const EMAIL_RE = /^[a-z0-9._%+-]{1,64}@([a-z0-9-]+\.)+[a-z]{2,24}$/i;

const TYPO_DOMAINS: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "gmal.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmail.om": "gmail.com",
  "yaho.com": "yahoo.com",
  "yahoo.co": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "hotmial.com": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "outlok.com": "outlook.com",
  "outlook.con": "outlook.com",
};

export function checkEmail(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (!value) return "Email address is required for application updates.";
  if (!value.includes("@")) return "Your email needs an “@”, like maria@gmail.com.";
  const [local, domain = ""] = value.split("@");
  if (!local) return "Add the part before the “@”, like maria@gmail.com.";
  if (!domain) return "Add your email provider after the “@”, like @gmail.com.";
  if (!domain.includes(".")) return `“@${domain}” is incomplete — did you mean @${domain}.com?`;
  if (!EMAIL_RE.test(value) || value.includes("..")) return "Enter a valid email address, like maria@gmail.com.";
  const fix = TYPO_DOMAINS[domain];
  if (fix) return `Did you mean @${fix}? Please check the spelling of your email.`;
  return null;
}

/** Accepts 09XXXXXXXXX or +63 9XXXXXXXXX (spaces, dashes and brackets allowed). */
export function normalizePhMobile(raw: string): string | null {
  const digits = raw.replace(/[\s\-().]/g, "");
  if (/^\+639\d{9}$/.test(digits)) return `0${digits.slice(3)}`;
  if (/^09\d{9}$/.test(digits)) return digits;
  return null;
}

export function checkPhMobile(raw: string, label = "mobile number"): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (normalizePhMobile(value)) return null;
  const digits = value.replace(/[^\d]/g, "");
  if (!/^(\+63|09)/.test(value.replace(/[\s\-().]/g, "")))
    return `Your ${label} must start with 09 or +63, like 0917 123 4567.`;
  if (digits.length < 11) return `That ${label} is too short — it needs 11 digits (09XX XXX XXXX).`;
  return `That ${label} is too long or has extra characters — use 09XX XXX XXXX or +63 9XX XXX XXXX.`;
}

export function formatPhMobile(raw: string): string {
  const normalized = normalizePhMobile(raw);
  if (!normalized) return raw;
  return `${normalized.slice(0, 4)} ${normalized.slice(4, 7)} ${normalized.slice(7)}`;
}
