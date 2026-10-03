import "dotenv/config";
import { pool } from "../src/db";

type ColumnRow = { column_name: string };

async function main() {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME AS column_name
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'id_template_config'
       AND COLUMN_NAME = 'design_settings'`,
  );
  if (!Array.isArray(rows)) {
    throw new Error("Could not inspect id_template_config columns.");
  }

  if ((rows as ColumnRow[]).length === 0) {
    await pool.query(
      `ALTER TABLE id_template_config
       ADD COLUMN design_settings JSON NULL`,
    );
    console.log("Added optional ID card design settings.");
  } else {
    console.log("ID card design settings are already installed.");
  }
}

main()
  .catch((error) => {
    console.error(
      "Template design migration failed:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
