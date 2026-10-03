import { eq } from "drizzle-orm";
import { UserRoundCog } from "lucide-react";
import { db } from "@/db";
import { adminProfiles } from "@/db/schema";
import { getAdminContext } from "@/lib/auth";
import ProfileEditor from "./profile-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Administrator Profile" };

export default async function AdminProfilePage() {
  const ctx = await getAdminContext();
  if (!ctx) return null;
  const [profile] = await db
    .select({ avatarDataUrl: adminProfiles.avatarDataUrl })
    .from(adminProfiles)
    .where(eq(adminProfiles.adminUserId, ctx.admin.id))
    .limit(1);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
          <UserRoundCog className="h-5 w-5" style={{ color: "var(--academic-blue)" }} aria-hidden />
          Administrator Profile
        </h1>
        <p className="text-muted text-sm">Update your contact details, profile photo, or sign-in password.</p>
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
