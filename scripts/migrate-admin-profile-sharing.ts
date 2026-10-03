import "dotenv/config";
import { pool } from "../src/db";

type ColumnRow = { column_name: string; data_type?: string };
type TableRow = { table_name: string };

async function main() {
  const [tokenColumns] = await pool.query(
    `SELECT COLUMN_NAME AS column_name
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'application_access_tokens'
       AND COLUMN_NAME = 'token_ciphertext'`,
  );
  if (!Array.isArray(tokenColumns)) throw new Error("Could not inspect access-token columns.");
  if ((tokenColumns as ColumnRow[]).length === 0) {
    await pool.query(
      `ALTER TABLE application_access_tokens
       ADD COLUMN token_ciphertext VARCHAR(512) NULL`,
    );
    console.log("Added encrypted recoverable-token storage.");
  } else {
    console.log("Encrypted recoverable-token storage is already installed.");
  }

  const [profileTables] = await pool.query(
    `SELECT TABLE_NAME AS table_name
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'admin_profiles'`,
  );
  if (!Array.isArray(profileTables)) throw new Error("Could not inspect administrator profile table.");
  if ((profileTables as TableRow[]).length === 0) {
    await pool.query(
      `CREATE TABLE admin_profiles (
         admin_user_id INT NOT NULL,
         avatar_data_url TEXT NULL,
         updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
         PRIMARY KEY (admin_user_id),
         CONSTRAINT admin_profiles_user_fk
           FOREIGN KEY (admin_user_id) REFERENCES admin_users(id)
           ON DELETE CASCADE
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    );
    console.log("Created administrator profile storage.");
  } else {
    console.log("Administrator profile storage is already installed.");
  }

  const [avatarColumns] = await pool.query(
    `SELECT COLUMN_NAME AS column_name, DATA_TYPE AS data_type
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'admin_profiles'
       AND COLUMN_NAME = 'avatar_data_url'`,
  );
  if (!Array.isArray(avatarColumns)) throw new Error("Could not inspect administrator profile photo storage.");
  const avatarColumn = (avatarColumns as ColumnRow[])[0];
  if (avatarColumn?.data_type?.toLowerCase() !== "mediumtext") {
    await pool.query(
      `ALTER TABLE admin_profiles
       MODIFY COLUMN avatar_data_url MEDIUMTEXT NULL`,
    );
    console.log("Expanded profile photo storage to MEDIUMTEXT.");
  } else {
    console.log("Profile photo storage capacity is already up to date.");
  }
}

main()
  .catch((error) => {
    console.error(
      "Admin profile and sharing migration failed:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
