import { asc, desc, sql } from "drizzle-orm";
import CountIndicator from "@/components/live-sync";
import { ChevronRight, QrCode } from "lucide-react";
import Link from "next/link";
import { db } from "@/db";
import { applicationAccessTokens } from "@/db/schema";
import { getAdminContext } from "@/lib/auth";
import { SCHOOL } from "@/lib/config";
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
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      {/* Breadcrumb & Page Head */}
      <div className="space-y-2">
        <nav className="flex items-center gap-1.5 text-xs text-muted font-medium" aria-label="Breadcrumb">
          <Link href="/admin" className="hover:text-[var(--ink)] transition-colors">
            Dashboard
          </Link>
          <ChevronRight className="h-3.5 w-3.5 opacity-60" aria-hidden />
          <span className="text-[var(--ink)] font-semibold">QR Codes</span>
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <div>
            <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-[var(--ink)]">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--academic-blue)]/12 text-[var(--academic-blue)] ring-1 ring-[var(--academic-blue)]/20 shadow-xs">
                <QrCode className="h-5 w-5" aria-hidden />
              </span>
              Application QR Codes
            </h1>
            <p className="text-muted text-sm mt-1">
              Generate revocable, time-limited access tokens for the public application form and export them as high-resolution QR codes.
            </p>
          </div>

          <CountIndicator section="qr" total={Number(total)} singular="Code" />
        </div>
      </div>

      <QrManager tokens={serialized} csrfToken={ctx!.csrfToken} dateOrder={dateOrder} page={page} totalPages={totalPages} school={{ name: SCHOOL.name, address: SCHOOL.address, motto: SCHOOL.motto }} />
    </div>
  );
}
