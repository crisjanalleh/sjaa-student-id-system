import { config } from "@/lib/config";

export function clientIp(req: Request): string {
  if (config.trustedProxy) {
    const fwd = req.headers.get("x-forwarded-for");
    if (fwd) {
      const first = fwd.split(",")[0]?.trim();
      if (first) return first.slice(0, 64);
    }
    const realIp = req.headers.get("x-real-ip");
    if (realIp) return realIp.trim().slice(0, 64);
  }
  return "direct";
}

export function userAgent(req: Request): string {
  return (req.headers.get("user-agent") || "").slice(0, 300);
}
