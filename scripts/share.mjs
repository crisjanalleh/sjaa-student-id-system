// Opens a public HTTPS address for this computer so students can scan the QR
// code from any network. Usage: npm run share   (keep this window open)
import { spawn } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const binary = path.join(
  root,
  "node_modules",
  "cloudflared",
  "bin",
  process.platform === "win32" ? "cloudflared.exe" : "cloudflared",
);
const shareFile = path.join(root, ".public-url");
const port = process.env.PORT || "3000";

if (!existsSync(binary)) {
  console.error("The tunnel program is missing. Run `npm install` first.");
  process.exit(1);
}

for (const name of [".env", ".env.local"]) {
  try {
    process.loadEnvFile(path.join(root, name));
  } catch {
    // The file may not exist.
  }
}

// With TUNNEL_TOKEN (a free named Cloudflare tunnel) the address is permanent
// and branded, e.g. https://sja-student-form.yourdomain.com (set as APP_URL).
const token = process.env.TUNNEL_TOKEN?.trim();
const fixedUrl = token ? process.env.APP_URL?.trim().replace(/\/+$/, "") : "";
if (token && (!fixedUrl || !fixedUrl.startsWith("https://"))) {
  console.error("TUNNEL_TOKEN is set, so APP_URL must be the https:// address of that tunnel.");
  process.exit(1);
}

const args = token
  ? ["tunnel", "--no-autoupdate", "run", "--token", token]
  : ["tunnel", "--url", `http://localhost:${port}`, "--no-autoupdate"];
const child = spawn(binary, args, {
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});

let announced = false;
function handle(chunk) {
  const text = chunk.toString();
  const quick = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
  const match = token ? (/Registered tunnel connection/i.test(text) ? [fixedUrl] : null) : quick;
  if (match && !announced) {
    announced = true;
    writeFileSync(shareFile, JSON.stringify({ url: match[0], pid: process.pid }));
    console.log("\n  [share] Public link is ready:\n");
    console.log(`    ${match[0]}\n`);
    console.log("  New QR codes generated in the admin page now use this link.");
    console.log("  Only the student form is reachable through it; the admin area is not.");
    console.log("  Keep this window open while testing. Press Ctrl+C to stop sharing.\n");
  } else if (/error|failed/i.test(text) && !announced) {
    console.error(text.trim());
  }
}
child.stdout.on("data", handle);
child.stderr.on("data", handle);

function cleanup() {
  rmSync(shareFile, { force: true });
  child.kill();
}
child.on("exit", (code) => {
  rmSync(shareFile, { force: true });
  console.log(`Tunnel stopped${code ? ` (exit ${code})` : ""}.`);
  process.exit(code ?? 0);
});
process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});
process.on("exit", () => rmSync(shareFile, { force: true }));
