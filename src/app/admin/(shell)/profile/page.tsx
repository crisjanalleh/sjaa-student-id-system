import { eq } from "drizzle-orm";
import { ChevronRight, ShieldCheck, UserRoundCog } from "lucide-react";
import Link from "next/link";
import { db } from "@/db";
import { adminProfiles } from "@/db/schema";
import { getAdminContext } from "@/lib/auth";
import ProfileEditor from "./profile-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Administrator Profile — San Jose Adventist Academy" };

export default async function AdminProfilePage() {
  const ctx = await getAdminContext();
  if (!ctx) return null;
  const [profile] = await db
    .select({ avatarDataUrl: adminProfiles.avatarDataUrl })
    .from(adminProfiles)
    .where(eq(adminProfiles.adminUserId, ctx.admin.id))
    .limit(1);

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      {/* Breadcrumb & Page Head */}
      <div className="space-y-2">
        <nav className="flex items-center gap-1.5 text-xs text-muted font-medium" aria-label="Breadcrumb">
          <Link href="/admin" className="hover:text-[var(--ink)] transition-colors">Dashboard</Link>
          <ChevronRight className="h-3.5 w-3.5 opacity-60" aria-hidden />
          <span className="text-[var(--ink)] font-semibold">Administrator Profile</span>
        </nav>
        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <div>
            <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-[var(--ink)]">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--academic-blue)]/12 text-[var(--academic-blue)] ring-1 ring-[var(--academic-blue)]/20 shadow-xs">
                <UserRoundCog className="h-5 w-5" aria-hidden />
              </span>
              Administrator Profile
            </h1>
            <p className="text-muted text-sm mt-1">
              Manage your personal administrator identity, credentials, photo, and access security.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Authorized Administrator
          </div>
        </div>
      </div>

      <ProfileEditor
        csrfToken={ctx.csrfToken}
        initial={{
          fullName: ctx.admin.fullName,
          username: ctx.admin.username,
          email: ctx.admin.email,
          avatarDataUrl: profile?.avatarDataUrl ?? null,
        }}
      />
    </div>
  );
}
