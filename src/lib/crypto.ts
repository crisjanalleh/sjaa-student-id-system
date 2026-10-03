import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomInt,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { config } from "@/lib/config";

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I/L

/** CSPRNG opaque token (base64url). Never stored raw — only its SHA-256. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function accessTokenEncryptionKey(): Buffer {
  return createHash("sha256").update(`access-token|${config.appSecret}`, "utf8").digest();
}

export function encryptAccessToken(raw: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", accessTokenEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(raw, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptAccessToken(payload: string): string | null {
  try {
    const [version, ivValue, tagValue, encryptedValue] = payload.split(".");
    if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) return null;
    const decipher = createDecipheriv("aes-256-gcm", accessTokenEncryptionKey(), Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

/** Length-agnostic constant-time comparison (hashes both sides first). */
export function safeEqual(a: string, b: string): boolean {
  const ha = Buffer.from(sha256Hex(a), "hex");
  const hb = Buffer.from(sha256Hex(b), "hex");
  return timingSafeEqual(ha, hb);
}

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;
const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, KEYLEN, SCRYPT_PARAMS);
  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt.toString(
    "base64",
  )}$${Buffer.from(key).toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, n, r, p, saltB64, keyB64] = stored.split("$");
    if (scheme !== "scrypt") return false;
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(keyB64, "base64");
    const actual = scryptSync(password, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return (
      actual.length === expected.length &&
      timingSafeEqual(Buffer.from(actual), expected)
    );
  } catch {
    return false;
  }
}

export function randomCode(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  }
  return out;
}

/** Human-friendly, non-sequential control number, e.g. SJAA-26-AB7K9M. */
export function newApplicationCode(now = new Date()): string {
  const yy = String(now.getFullYear()).slice(-2);
  return `SJAA-${yy}-${randomCode(6)}`;
}

export function newBatchCode(now = new Date()): string {
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `PB-${yy}${mm}-${randomCode(5)}`;
}

/** Privacy-preserving IP identifier for audit logs. */
export function hashIp(ip: string): string {
  return sha256Hex(`ip|${ip}|${config.appSecret}`).slice(0, 32);
}
