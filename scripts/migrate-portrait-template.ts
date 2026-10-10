import "dotenv/config";
import { pool } from "../src/db";

type ColumnRow = { column_name: string };

async function main() {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME AS column_name
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'id_template_config'
       AND COLUMN_NAME = 'orientation'`,
  );
  if (!Array.isArray(rows) || (rows as ColumnRow[]).length === 0) {
    throw new Error(
      "The id_template_config.orientation column is missing. Run the existing orientation migration first.",
    );
  }

  const [result] = await pool.query(
    `UPDATE id_template_config
     SET orientation = 'portrait'
     WHERE orientation <> 'portrait'`,
  );
  if (typeof result !== "object" || result === null || !("affectedRows" in result)) {
    throw new Error("Could not update the saved template orientation.");
  }

  await pool.query(
    `ALTER TABLE id_template_config
     MODIFY COLUMN orientation ENUM('landscape', 'portrait')
     NOT NULL DEFAULT 'portrait'`,
  );
  console.log(`Portrait-only template configuration is active (${result.affectedRows} legacy setting(s) updated).`);
}

main()
  .catch((error) => {
    console.error(
      "Portrait template migration failed:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
