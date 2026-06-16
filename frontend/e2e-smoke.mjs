// Headless smoke test for the SuiData dapp.
// Loads the app (no wallet connected) and verifies it renders without errors.
import { chromium } from "playwright";

const URL = process.env.URL || "http://localhost:5173/";

const browser = await chromium.launch({
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--single-process",
  ],
});
const page = await browser.newPage();

const consoleErrors = [];
const pageErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => pageErrors.push(e.message));

await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);

const h1 = await page.locator("h1").first().textContent();
const connectBtn = await page.getByRole("button", { name: /connect/i }).count();
const prompt = await page.getByText(/connect a sui wallet/i).count();
const bodyText = await page.locator("body").innerText();

await page.screenshot({ path: "/tmp/suidata-home.png", fullPage: true });

console.log("=== SuiData smoke test ===");
console.log("h1:", JSON.stringify(h1));
console.log("connect button present:", connectBtn > 0);
console.log("wallet prompt present:", prompt > 0);
console.log("package warning shown:", bodyText.includes("not yet published"));
console.log("pageErrors:", pageErrors);
console.log("consoleErrors:", consoleErrors);

await browser.close();

const ok = h1 === "SuiData" && connectBtn > 0 && pageErrors.length === 0;
console.log(ok ? "\nRESULT: PASS" : "\nRESULT: FAIL");
process.exit(ok ? 0 : 1);
