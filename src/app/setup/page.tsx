import { Terminal, TriangleAlert } from "lucide-react";
import { db } from "@/db";
import { adminUsers } from "@/db/schema";
import { sql } from "drizzle-orm";
import { SCHOOL, config } from "@/lib/config";
import SetupForm from "./setup-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "First-Run Setup" };

export default async function SetupPage() {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(adminUsers);
  const initialized = Number(count) > 0;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-extrabold tracking-tight">{SCHOOL.name}</h1>
          <p className="text-muted mt-1 text-sm">Student ID Issuance System — First-Run Setup</p>
        </div>
        <div className="card p-6">
          {initialized ? (
            <div
              className="flex items-start gap-3 rounded-md border px-4 py-3 text-sm"
              style={{ borderColor: "var(--line-strong)" }}
              role="alert"
            >
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--danger)" }} aria-hidden />
              <div>
                <p className="font-bold">Setup is disabled</p>
                <p className="text-muted mt-1">
                  An administrator account already exists. This setup page is permanently
                  disabled after initialization. Sign in at{" "}
                  <a className="font-semibold underline underline-offset-2" href="/admin/login">
                    /admin/login
                  </a>
                  .
                </p>
              </div>
            </div>
          ) : !config.setupSecret ? (
            <div className="text-sm">
              <p className="mb-3 flex items-center gap-2 font-bold">
                <Terminal className="h-4 w-4" style={{ color: "var(--academic-blue)" }} aria-hidden />
                Create the first administrator from the CLI
              </p>
              <p className="text-muted mb-3">
                No <code>SETUP_SECRET</code> is configured, so browser setup is disabled.
                Run the interactive bootstrap on the server instead:
              </p>
              <pre
                className="overflow-x-auto rounded-md border p-3 text-xs"
                style={{ borderColor: "var(--line)", background: "var(--bg)" }}
              >
                npx tsx scripts/create-admin.ts
              </pre>
              <p className="text-muted mt-3">
                Alternatively set <code>SETUP_SECRET</code> in the environment, restart,
                and return to this page.
              </p>
            </div>
          ) : (
            <SetupForm />
          )}
        </div>
      </div>
    </div>
  );
}
