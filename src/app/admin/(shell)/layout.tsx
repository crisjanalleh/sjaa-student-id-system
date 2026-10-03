import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import AdminShell from "@/components/admin-shell";
import { db } from "@/db";
import { adminProfiles } from "@/db/schema";
import { getAdminContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminShellLayout({ children }: { children: ReactNode }) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/login");
  const [profile] = await db
    .select({ avatarDataUrl: adminProfiles.avatarDataUrl })
    .from(adminProfiles)
    .where(eq(adminProfiles.adminUserId, ctx.admin.id))
    .limit(1);
  const avatarDataUrl = profile?.avatarDataUrl?.startsWith("data:image/jpeg;base64,")
    ? profile.avatarDataUrl
    : null;

  return (
    <AdminShell
      fullName={ctx.admin.fullName}
      username={ctx.admin.username}
      avatarDataUrl={avatarDataUrl}
      csrfToken={ctx.csrfToken}
    >
      {children}
    </AdminShell>
  );
}
