import "dotenv/config";
import { pool } from "../src/db";

type ColumnRow = { column_name: string };

async function main() {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME AS column_name
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'student_applications'
       AND COLUMN_NAME = 'student_signature_data_url'`,
  );
  if (!Array.isArray(rows)) {
    throw new Error("Could not inspect student_applications columns.");
  }

  if ((rows as ColumnRow[]).length === 0) {
    await pool.query(
      `ALTER TABLE student_applications
       ADD COLUMN student_signature_data_url MEDIUMTEXT NULL`,
    );
    console.log("Added private student signature storage.");
  } else {
    console.log("Student signature storage is already installed.");
  }
}

main()
  .catch((error) => {
    console.error(
      "Student signature migration failed:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
