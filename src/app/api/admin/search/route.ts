import { and, desc, isNull, like, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { studentApplications } from "@/db/schema";
import { requireAdminApi } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMIT = 8;

export async function GET(req: Request) {
  const { error } = await requireAdminApi();
  if (error) return error;

  const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, 80).trim();
  const headers = { "Cache-Control": "no-store" };
  if (!q) return NextResponse.json({ ok: true, results: [], total: 0 }, { headers });

  const pattern = `%${q.toLowerCase().replace(/[\\%_]/g, "\\$&")}%`;
  const firstLast = sql`LOWER(CONCAT_WS(' ', ${studentApplications.firstName}, ${studentApplications.middleName}, ${studentApplications.lastName}))`;
  const lastFirst = sql`LOWER(CONCAT_WS(' ', ${studentApplications.lastName}, ${studentApplications.firstName}))`;
  const where = and(
    isNull(studentApplications.deletedAt),
    or(
      like(sql`LOWER(${studentApplications.applicationCode})`, pattern),
      like(sql`LOWER(${studentApplications.studentIdNumber})`, pattern),
      like(firstLast, pattern),
      like(lastFirst, pattern),
    ),
  );

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: studentApplications.id,
        applicationCode: studentApplications.applicationCode,
        studentIdNumber: studentApplications.studentIdNumber,
        firstName: studentApplications.firstName,
        middleName: studentApplications.middleName,
        lastName: studentApplications.lastName,
        suffix: studentApplications.suffix,
        gradeLevel: studentApplications.gradeLevel,
        status: studentApplications.status,
      })
      .from(studentApplications)
      .where(where)
      .orderBy(desc(studentApplications.createdAt), desc(studentApplications.id))
      .limit(LIMIT),
    db.select({ total: sql<number>`count(*)` }).from(studentApplications).where(where),
  ]);

  return NextResponse.json({ ok: true, results: rows, total: Number(total) }, { headers });
}
