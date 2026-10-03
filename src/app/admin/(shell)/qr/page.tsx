import { asc, desc, sql } from "drizzle-orm";
import { QrCode } from "lucide-react";
import { db } from "@/db";
import { applicationAccessTokens } from "@/db/schema";
import { getAdminContext } from "@/lib/auth";
import QrManager from "./qr-manager";
import { ADMIN_PAGE_SIZE } from "@/lib/admin-pagination";

export const dynamic = "force-dynamic";

export const metadata = { title: "QR Code Generator" };

export default async function QrPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getAdminContext();
  const params = await searchParams;
  const rawOrder = Array.isArray(params.dateOrder) ? params.dateOrder[0] : params.dateOrder;
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const dateOrder = rawOrder === "oldest" ? "oldest" : "newest";
  const requestedPage = Math.max(1, Number.parseInt(rawPage || "1", 10) || 1);
  const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(applicationAccessTokens);
  const totalPages = Math.max(1, Math.ceil(Number(total) / ADMIN_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const tokens = await db
    .select({ token: applicationAccessTokens })
    .from(applicationAccessTokens)
    .orderBy(dateOrder === "oldest" ? asc(applicationAccessTokens.createdAt) : desc(applicationAccessTokens.createdAt), desc(applicationAccessTokens.id))
    .limit(ADMIN_PAGE_SIZE)
    .offset((page - 1) * ADMIN_PAGE_SIZE);

  const serialized = tokens.map(({ token }) => ({
    id: token.id,
    label: token.label,
    createdAt: token.createdAt.toISOString(),
    expiresAt: token.expiresAt ? token.expiresAt.toISOString() : null,
    revokedAt: token.revokedAt ? token.revokedAt.toISOString() : null,
    lastUsedAt: token.lastUsedAt ? token.lastUsedAt.toISOString() : null,
    useCount: token.useCount,
  }));

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
          <QrCode className="h-5 w-5" style={{ color: "var(--academic-blue)" }} aria-hidden />
          Application QR Codes
        </h1>
        <p className="text-muted text-sm">
          Generate revocable, time-limited access tokens for the public application form
          and export them as high-resolution QR codes.
        </p>
      </div>
      <QrManager tokens={serialized} csrfToken={ctx!.csrfToken} dateOrder={dateOrder} page={page} totalPages={totalPages} total={Number(total)} />
    </div>
  );
}
