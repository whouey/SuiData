// Expose a local port over real HTTPS so a phone's camera (a secure-context API)
// works. Prefers cloudflared if installed (cleanest URL); otherwise uses
// localtunnel (npm, no account). Prints the URL as a scannable QR code.

import { spawn } from "node:child_process";
import qrcode from "qrcode-terminal";

function have(cmd) {
  return new Promise((res) => {
    const p = spawn("which", [cmd]);
    p.on("close", (code) => res(code === 0));
    p.on("error", () => res(false));
  });
}

function printUrl(url) {
  console.log("\n  Open on your phone (same as scanning the QR):\n");
  console.log("    " + url + "\n");
  qrcode.generate(url, { small: true });
  console.log("");
}

async function viaCloudflared(port) {
  return new Promise((resolve, reject) => {
    const p = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${port}`]);
    let done = false;
    const onData = (buf) => {
      const m = String(buf).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (m && !done) {
        done = true;
        resolve({ url: m[0], proc: p });
      }
    };
    p.stdout.on("data", onData);
    p.stderr.on("data", onData);
    p.on("close", () => {
      if (!done) reject(new Error("cloudflared exited before printing a URL"));
    });
    setTimeout(() => !done && reject(new Error("cloudflared timeout")), 30000);
  });
}

async function viaLocaltunnel(port) {
  const { default: localtunnel } = await import("localtunnel");
  const t = await localtunnel({ port });
  return { url: t.url, proc: t };
}

/**
 * Start a tunnel to `port`, print the HTTPS URL + QR, and keep it open.
 * Returns the chosen url. The process stays alive until killed.
 */
export async function startTunnel(port = 5173) {
  let chosen;
  if (await have("cloudflared")) {
    try {
      chosen = await viaCloudflared(port);
    } catch {
      /* fall through */
    }
  }
  if (!chosen) chosen = await viaLocaltunnel(port);
  printUrl(chosen.url);
  console.log("  (keep this running. Ensure `cd frontend && npm run dev` is up.)");
  return chosen.url;
}

// CLI: node scripts/lib/tunnel.mjs [port]
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.argv[2] || 5173);
  await startTunnel(port);
}
