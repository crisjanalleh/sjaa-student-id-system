export function isDuplicateEntry(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ER_DUP_ENTRY"
  );
}

export function duplicateEntryMessage(error: unknown): string {
  return error instanceof Error ? error.message : "";
}
