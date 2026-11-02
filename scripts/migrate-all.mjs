// Applies every pending database migration. Each migration checks the live
// schema first, so running them all on every start is safe and does nothing
// when the database is already up to date.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tsxCli = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");

export function runMigrations({ quiet = false } = {}) {
  const files = readdirSync(path.join(root, "scripts"))
    .filter((name) => /^migrate-.+\.ts$/.test(name))
    .sort();
  let failed = 0;
  for (const file of files) {
    const result = spawnSync(process.execPath, [tsxCli, path.join("scripts", file)], {
      cwd: root,
      encoding: "utf8",
    });
    if (result.status !== 0) {
      failed += 1;
      const detail = `${result.stderr || ""}${result.stdout || ""}`.trim().split("\n").slice(-3).join("\n");
      console.warn(`[db] ${file} did not complete:\n${detail}`);
    } else if (!quiet && result.stdout?.trim()) {
      console.log(`[db] ${result.stdout.trim().split("\n").pop()}`);
    }
  }
  if (failed) {
    console.warn(`[db] ${failed} migration(s) failed. Check that the database is running and DATABASE_URL is correct in .env.`);
  } else {
    console.log("[db] Database is up to date.");
  }
  return failed === 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(runMigrations() ? 0 : 1);
}
