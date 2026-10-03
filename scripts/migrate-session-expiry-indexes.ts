import "dotenv/config";
import { pool } from "../src/db";

type IndexRow = { index_name: string };

const indexes = [
  { table: "admin_sessions", name: "admin_sessions_expires_idx" },
  { table: "form_sessions", name: "form_sessions_expires_idx" },
] as const;

async function main() {
  for (const index of indexes) {
    const [rows] = await pool.query(
      `SELECT INDEX_NAME AS index_name
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND INDEX_NAME = ?`,
      [index.table, index.name],
    );
    if (!Array.isArray(rows)) {
      throw new Error(`Could not inspect ${index.table} indexes.`);
    }
    if ((rows as IndexRow[]).length > 0) {
      console.log(`${index.name} is already installed.`);
      continue;
    }

    await pool.query(
      `CREATE INDEX ${index.name} ON ${index.table} (expires_at)`,
    );
    console.log(`Added ${index.name}.`);
  }
}

main()
  .catch((error) => {
    console.error(
      "Session expiry-index migration failed:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
