// Vendor tesseract.js assets into frontend/public/tesseract so OCR runs fully
// client-side with NO network call (and works on a flaky stage hotspot). Assets
// are gitignored; run once before the demo:  npm run vendor:ocr
//
// If you skip this, OCR simply fails to load and the seller app silently falls
// back to the cached known-good receipt — the demo still works.

import { copyFileSync, mkdirSync, existsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "frontend", "node_modules");
const OUT = join(ROOT, "frontend", "public", "tesseract");
mkdirSync(OUT, { recursive: true });

// Worker.
copyFileSync(
  join(SRC, "tesseract.js", "dist", "worker.min.js"),
  join(OUT, "worker.min.js"),
);

// Core variants tesseract.js may select (SIMD / relaxed-SIMD / base, LSTM engine).
const coreDir = join(SRC, "tesseract.js-core");
for (const base of [
  "tesseract-core-lstm",
  "tesseract-core-simd-lstm",
  "tesseract-core-relaxedsimd-lstm",
]) {
  for (const ext of [".wasm", ".wasm.js"]) {
    copyFileSync(join(coreDir, base + ext), join(OUT, base + ext));
  }
}

// English language data (fast model — smaller + quicker on mobile CPUs).
const langFile = join(OUT, "eng.traineddata.gz");
if (existsSync(langFile)) {
  console.log("lang data already present");
} else {
  const url =
    "https://tessdata.projectnaptha.com/4.0.0_fast/eng.traineddata.gz";
  console.log("downloading", url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`lang download failed: ${res.status}`);
  writeFileSync(langFile, Buffer.from(await res.arrayBuffer()));
}

console.log("vendored tesseract assets ->", OUT);
