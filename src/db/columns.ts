import { getTableColumns } from "drizzle-orm";
import { studentApplications } from "@/db/schema";

// List views never show the signature image (a large data URL), so they must not download it per row.
const all: Partial<ReturnType<typeof getTableColumns<typeof studentApplications>>> = {
  ...getTableColumns(studentApplications),
};
delete all.studentSignatureDataUrl;

export const applicationListColumns = all as Omit<
  ReturnType<typeof getTableColumns<typeof studentApplications>>,
  "studentSignatureDataUrl"
>;
