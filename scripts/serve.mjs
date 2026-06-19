// One command to serve the seller app over HTTPS for the phone: starts the Vite
// dev server, then opens a tunnel and prints the HTTPS URL + QR code.
//
//   npm run demo:serve

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { startTunnel } from "./lib/tunnel.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.VITE_PORT || 5173);

console.log(`Starting Vite dev server on :${PORT} …`);
const vite = spawn("npm", ["run", "dev", "--", "--port", String(PORT), "--host"], {
  cwd: join(ROOT, "frontend"),
  stdio: "inherit",
});
process.on("exit", () => vite.kill());
process.on("SIGINT", () => {
  vite.kill();
  process.exit(0);
});

// Give Vite a moment to bind the port, then tunnel.
await new Promise((r) => setTimeout(r, 4000));
try {
  await startTunnel(PORT);
} catch (e) {
  console.error("tunnel failed:", e.message);
  console.error("Dev server is still up locally on http://localhost:" + PORT);
}
