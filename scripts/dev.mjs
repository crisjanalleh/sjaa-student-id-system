// Starts the Next.js dev server and the public share tunnel together.
// If the tunnel cannot start (offline, missing binary), the app keeps running.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");

// Open the admin sign-in page in the default browser once the server is up,
// so `npm run dev` does not require typing the URL by hand.
function openBrowser(url) {
  const command = process.platform === "win32" ? "cmd" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  try {
    spawn(command, args, { stdio: "ignore", detached: true, windowsHide: true }).unref();
  } catch {
    console.log(`[dev] Open ${url} in your browser.`);
  }
}

let opened = false;
function announce(url) {
  if (opened || process.env.NO_OPEN) return;
  opened = true;
  openBrowser(url);
  console.log(`[dev] Opening ${url} in your browser.`);
}

// Next.js compiles each route on first request in development, which makes the
// first student scan slow. Visiting the student routes once up front removes that delay.
let warmed = false;
async function warmStudentRoutes(port) {
  if (warmed) return;
  warmed = true;
  for (const route of ["/apply", "/apply/warmup", "/?access_token=warmup", "/api/apply/keepalive"]) {
    try {
      await fetch(`http://localhost:${port}${route}`, { redirect: "manual" });
    } catch {
      /* the server may still be starting; warming is best effort */
    }
  }
  console.log("[dev] Student application routes are warmed up.");
}

const app = spawn(process.execPath, [nextBin, "dev", ...process.argv.slice(2)], {
  cwd: root,
  stdio: ["inherit", "pipe", "inherit"],
});
app.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  const match = chunk.toString().match(/https?:\/\/localhost:(\d+)/i);
  if (match) {
    announce(`http://localhost:${match[1]}/admin/login`);
    setTimeout(() => void warmStudentRoutes(match[1]), 1500);
  }
});
const share = spawn(process.execPath, [path.join(root, "scripts", "share.mjs")], { cwd: root, stdio: "inherit" });
share.on("exit", (code) => {
  if (code) console.log("[share] Tunnel is not running; the app is still available on localhost.");
});

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  share.kill("SIGINT");
  app.kill("SIGINT");
  setTimeout(() => process.exit(code), 500);
}
app.on("exit", (code) => stop(code ?? 0));
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
