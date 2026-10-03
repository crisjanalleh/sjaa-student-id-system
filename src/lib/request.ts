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

export class RequestBodyTooLargeError extends Error {
  constructor() {
    super("Request body exceeds the permitted size.");
    this.name = "RequestBodyTooLargeError";
  }
}

export async function readFormDataBounded(
  req: Request,
  maxBytes: number,
): Promise<FormData> {
  const declaredLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new RequestBodyTooLargeError();
  }

  if (!req.body) return new FormData();
  const reader = req.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        throw new RequestBodyTooLargeError();
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  const contentType = req.headers.get("content-type");
  if (!contentType) throw new TypeError("Form request is missing its content type.");
  return new Response(Buffer.concat(chunks), {
    headers: { "content-type": contentType },
  }).formData();
}

export function userAgent(req: Request): string {
  return (req.headers.get("user-agent") || "").slice(0, 300);
}
