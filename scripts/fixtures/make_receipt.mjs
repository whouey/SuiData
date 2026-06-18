// Render fixtures/receipt.json as a receipt photo (receipt.png) using the
// Playwright Chromium already installed under frontend/. This gives the live OCR
// step a real image input that matches the cached known-good JSON.
//
//   node scripts/fixtures/make_receipt.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(HERE, "..", "..", "frontend", "/"));
const { chromium } = require("playwright");

const r = JSON.parse(readFileSync(join(HERE, "receipt.json"), "utf8"));
const rows = r.items
  .map(
    (i) =>
      `<tr><td>${i.name}</td><td class="p">${i.price.toFixed(2)}</td></tr>`,
  )
  .join("");

const html = `<!doctype html><html><head><meta charset="utf8"><style>
  body{margin:0;background:#888;font-family:'Courier New',monospace}
  .r{width:320px;margin:24px auto;background:#fff;padding:22px 26px;
     box-shadow:0 6px 20px rgba(0,0,0,.35)}
  h1{font-size:20px;text-align:center;margin:0 0 2px;letter-spacing:1px}
  .sub{text-align:center;font-size:12px;color:#444;margin:0 0 12px}
  hr{border:none;border-top:1px dashed #999;margin:10px 0}
  table{width:100%;border-collapse:collapse;font-size:14px}
  td{padding:3px 0}
  .p{text-align:right}
  .tot{font-weight:bold;font-size:16px}
  .ft{text-align:center;font-size:11px;color:#666;margin-top:14px}
</style></head><body>
  <div class="r">
    <h1>${r.store.toUpperCase()}</h1>
    <p class="sub">${r.date} · ${r.currency}</p>
    <hr>
    <table>${rows}</table>
    <hr>
    <table><tr class="tot"><td>TOTAL</td><td class="p">${r.total.toFixed(
      2,
    )}</td></tr></table>
    <p class="ft">*** THANK YOU ***</p>
  </div>
</body></html>`;

const browser = await chromium.launch({
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--single-process"],
});
const page = await browser.newPage({ viewport: { width: 368, height: 420 } });
await page.setContent(html, { waitUntil: "load" });
await page.locator(".r").screenshot({ path: join(HERE, "receipt.png") });
await browser.close();
console.log("wrote", join(HERE, "receipt.png"));
