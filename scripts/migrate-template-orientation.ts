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

  if (!Array.isArray(rows)) {
    throw new Error("Could not inspect id_template_config columns.");
  }

  if ((rows as ColumnRow[]).length === 0) {
    await pool.query(
      `ALTER TABLE id_template_config
       ADD COLUMN orientation ENUM('landscape', 'portrait')
       NOT NULL DEFAULT 'landscape' AFTER school_year`,
    );
    console.log("Added ID card orientation; existing templates remain landscape.");
  } else {
    console.log("ID card orientation is already installed.");
  }
}

main()
  .catch((error) => {
    console.error(
      "Template orientation migration failed:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
