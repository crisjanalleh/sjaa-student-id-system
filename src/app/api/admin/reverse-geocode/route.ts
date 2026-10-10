import { NextResponse } from "next/server";
import { csrfOk, requireAdminApi } from "@/lib/auth";
import { readJsonObjectBounded } from "@/lib/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function response(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

// Admin-only proxy to OpenStreetMap Nominatim; the browser CSP blocks direct calls.
export async function POST(req: Request) {
  const { ctx, error } = await requireAdminApi();
  if (error) return error;
  if (!csrfOk(req, ctx.csrfToken)) return response(403, { ok: false, error: "Security validation failed." });

  let body: Record<string, unknown>;
  try {
    body = await readJsonObjectBounded(req, 1024);
  } catch {
    return response(400, { ok: false, error: "Could not read the coordinates." });
  }
  const lat = Number(body.lat);
  const lon = Number(body.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return response(422, { ok: false, error: "Invalid coordinates." });
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", lat.toFixed(6));
    url.searchParams.set("lon", lon.toFixed(6));
    url.searchParams.set("zoom", "18");
    url.searchParams.set("addressdetails", "1");
    const res = await fetch(url, {
      headers: { "User-Agent": "SJAA-Student-ID-System/1.0", "Accept-Language": "en" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = (await res.json()) as { address?: Record<string, string>; display_name?: string };
    const a = data.address ?? {};
    const parts = [
      a.road,
      a.neighbourhood || a.suburb || a.quarter || a.village,
      a.city || a.town || a.municipality,
      a.state || a.county,
    ].filter((p): p is string => Boolean(p));
    const address = (parts.length >= 2 ? parts.join(", ") : data.display_name || "").slice(0, 200);
    if (!address) return response(404, { ok: false, error: "No address was found for this position." });
    return response(200, { ok: true, address });
  } catch {
    return response(502, { ok: false, error: "The address lookup service is unavailable. Please type the address instead." });
  }
}
