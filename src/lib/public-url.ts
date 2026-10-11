import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { config } from "@/lib/config";

/**
 * The public address students use. In production this is APP_URL. While
 * testing, `npm run share` opens a secure tunnel and records its address in
 * `.public-url`, so links and QR codes work on any network without editing
 * .env or restarting the server.
 */
const SHARE_FILE = path.join(process.cwd(), ".public-url");
const CACHE_MS = 3000;

let cached: { at: number; url: string | null } = { at: 0, url: null };

function isLocalUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local");
  } catch {
    return true;
  }
}

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readTunnelUrl(): string | null {
  const now = Date.now();
  if (now - cached.at < CACHE_MS) return cached.url;
  let url: string | null = null;
  try {
    if (existsSync(SHARE_FILE)) {
      const data = JSON.parse(readFileSync(SHARE_FILE, "utf8")) as { url?: unknown; pid?: unknown };
      if (
        typeof data.url === "string" &&
        data.url.startsWith("https://") &&
        typeof data.pid === "number" &&
        processAlive(data.pid)
      ) {
        url = new URL(data.url).origin;
      }
    }
  } catch {
    url = null;
  }
  cached = { at: now, url };
  return url;
}

export function getPublicBaseUrl(): string {
  if (!isLocalUrl(config.appUrl)) return config.appUrl;
  return readTunnelUrl() ?? config.appUrl;
}

export function isTunnelActive(): boolean {
  return readTunnelUrl() !== null;
}

/** True when the request arrived through the public tunnel / reverse proxy. */
export function isTunneledRequest(headers: Headers): boolean {
  return headers.has("cf-ray") || headers.has("cf-connecting-ip");
}

export function isPublicBaseUrlLocal(): boolean {
  return isLocalUrl(getPublicBaseUrl());
}
