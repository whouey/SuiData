// Headless smoke test for the Cuttle mobile dapp.
// Loads the app at a phone viewport (no wallet) and verifies the zkLogin screen
// renders cleanly with no errors and no horizontal overflow.
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
const page = await browser.newPage({
  viewport: { width: 380, height: 780 },
  deviceScaleFactor: 2,
});

const consoleErrors = [];
const pageErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => pageErrors.push(e.message));

await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);

const h1 = await page.locator("h1").first().textContent();
// zkLogin sign-in (or the "configure Enoki" notice when keys are unset).
const loginPresent = await page
  .locator(".btn--google, .notice")
  .count();
const noHScroll = await page.evaluate(
  () =>
    document.documentElement.scrollWidth <=
    document.documentElement.clientWidth + 1,
);
const manifest = await page.evaluate(() =>
  fetch("/manifest.webmanifest").then((r) => r.status),
);

await page.screenshot({ path: "/tmp/cuttle-home.png", fullPage: true });

console.log("=== Cuttle mobile smoke test ===");
console.log("h1:", JSON.stringify(h1));
console.log("zkLogin screen present:", loginPresent > 0);
console.log("no horizontal scroll @380px:", noHScroll);
console.log("manifest status:", manifest);
console.log("pageErrors:", pageErrors);
console.log("consoleErrors:", consoleErrors);

await browser.close();

const ok =
  h1 === "Cuttle" &&
  loginPresent > 0 &&
  noHScroll &&
  manifest === 200 &&
  pageErrors.length === 0;
console.log(ok ? "\nRESULT: PASS" : "\nRESULT: FAIL");
process.exit(ok ? 0 : 1);
