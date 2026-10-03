import "dotenv/config";
import { pool } from "../src/db";

type ColumnRow = { column_name: string };
type IndexRow = { index_name: string };

async function main() {
  const [columnRows] = await pool.query(
    `SELECT COLUMN_NAME AS column_name
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'notification_logs'
       AND COLUMN_NAME IN ('acknowledgement_token_hash', 'acknowledged_at')`,
  );
  if (!Array.isArray(columnRows)) throw new Error("Could not inspect notification acknowledgement columns.");
  const columns = new Set((columnRows as ColumnRow[]).map((row) => row.column_name));
  if (!columns.has("acknowledgement_token_hash")) {
    await pool.query(
      `ALTER TABLE notification_logs
       ADD COLUMN acknowledgement_token_hash VARCHAR(64) NULL`,
    );
    console.log("Added notification acknowledgement token storage.");
  } else {
    console.log("Notification acknowledgement token storage is already installed.");
  }
  if (!columns.has("acknowledged_at")) {
    await pool.query(
      `ALTER TABLE notification_logs
       ADD COLUMN acknowledged_at DATETIME(3) NULL`,
    );
    console.log("Added notification acknowledgement timestamp.");
  } else {
    console.log("Notification acknowledgement timestamp is already installed.");
  }

  const [indexRows] = await pool.query(
    `SELECT INDEX_NAME AS index_name
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'notification_logs'
       AND INDEX_NAME = 'notification_logs_ack_token_uq'`,
  );
  if (!Array.isArray(indexRows)) throw new Error("Could not inspect notification acknowledgement index.");
  if ((indexRows as IndexRow[]).length === 0) {
    await pool.query(
      `CREATE UNIQUE INDEX notification_logs_ack_token_uq
       ON notification_logs (acknowledgement_token_hash)`,
    );
    console.log("Added notification acknowledgement token uniqueness.");
  } else {
    console.log("Notification acknowledgement token index is already installed.");
  }
}

main()
  .catch((error) => {
    console.error(
      "Notification acknowledgement migration failed:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
