import "dotenv/config";
import { stdin, stdout } from "node:process";
import * as readline from "node:readline/promises";
import { sql } from "drizzle-orm";

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const USERNAME_RE = /^[A-Za-z0-9._-]{3,64}$/;

async function hiddenQuestion(rl: readline.Interface, query: string): Promise<string> {
  if (!stdin.isTTY) {
    return rl.question(query);
  }
  const rlAny = rl as unknown as { _writeToOutput?: (s: string) => void };
  const original = rlAny._writeToOutput?.bind(rl);
  if (!original) return rl.question(query);
  rlAny._writeToOutput = (s: string) => {
    if (s.includes(query)) original(s);
  };
  try {
    return await rl.question(query).finally(() => stdout.write("\n"));
  } finally {
    rlAny._writeToOutput = original;
  }
}

async function main() {
  const { db, pool } = await import("../src/db/index");
  const { adminUsers } = await import("../src/db/schema");
  const { hashPassword } = await import("../src/lib/crypto");
  const { audit } = await import("../src/lib/audit");

  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(adminUsers);
    if (Number(count) > 0) {
      console.error("An administrator account already exists. Bootstrap is disabled.");
      process.exit(1);
    }

    const envUser = process.env.SJAA_ADMIN_USERNAME?.trim();
    const envName = process.env.SJAA_ADMIN_NAME?.trim();
    const envEmail = process.env.SJAA_ADMIN_EMAIL?.trim().toLowerCase();
    const envPassword = process.env.SJAA_ADMIN_PASSWORD;
    const scripted = Boolean(envUser && envName && envEmail && envPassword);

    let username: string, fullName: string, email: string, password: string;

    if (scripted) {
      username = envUser!;
      fullName = envName!;
      email = envEmail!;
      password = envPassword!;
    } else {
      stdout.write("=== SJAA ID System — First Administrator Bootstrap ===\n");
      stdout.write("There is no default password in this system. Create one now.\n\n");
      const rl = readline.createInterface({ input: stdin, output: stdout, terminal: stdin.isTTY });
      username = (await rl.question("Username (3-64: letters, digits, . _ -): ")).trim();
      fullName = (await rl.question("Full name: ")).trim();
      email = (await rl.question("Email address: ")).trim().toLowerCase();
      password = await hiddenQuestion(rl, "Password (min 12 chars): ");
      const confirm = await hiddenQuestion(rl, "Confirm password: ");
      rl.close();
      if (password !== confirm) {
        console.error("Passwords do not match.");
        process.exit(1);
      }
    }

    if (!USERNAME_RE.test(username)) {
      console.error("Invalid username (3-64: letters, digits, dot, dash, underscore).");
      process.exit(1);
    }
    if (!fullName) {
      console.error("Full name is required.");
      process.exit(1);
    }
    if (!EMAIL_RE.test(email)) {
      console.error("Invalid email address.");
      process.exit(1);
    }
    if (password.length < 12) {
      console.error("Password must be at least 12 characters.");
      process.exit(1);
    }

    const rows = await db
      .insert(adminUsers)
      .values({ username, fullName, email, passwordHash: hashPassword(password) })
      .$returningId();

    await audit({
      adminId: rows[0].id,
      action: "admin.setup_completed",
      entityType: "admin",
      entityId: rows[0].id,
      metadata: { method: scripted ? "cli-scripted" : "cli" },
    });

    stdout.write(`\nAdministrator "${username}" created successfully.\n`);
    stdout.write("Sign in at /admin/login. The /setup page is now permanently disabled.\n");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Bootstrap failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
