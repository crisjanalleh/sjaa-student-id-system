import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getAdminContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Chromeless layout for print output — no sidebar/topbar in the print media. */
export default async function PrintLayout({ children }: { children: ReactNode }) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/login");
  return <>{children}</>;
}
