// In-browser OCR with tesseract.js — keyless, client-side, no OCR API call.
// Assets are self-hosted under /tesseract (run `npm run vendor:ocr`). If OCR is
// slow, fails, or misreads, we silently fall back to the cached known-good
// receipt: capture is theater; the data is pre-validated.

import { createWorker } from "tesseract.js";
import {
  CACHED_RECEIPT,
  validateReceipt,
  type Receipt,
} from "./receipt";

const OCR_TIMEOUT_MS = 20000;

export type OcrSource = "ocr" | "cached";
export interface OcrResult {
  receipt: Receipt;
  source: OcrSource;
  rawText?: string;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("ocr timeout")), ms)),
  ]);
}

/** Best-effort parse of raw OCR text into our receipt schema. Throws if unsure. */
function parseReceipt(text: string): Receipt {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 3) throw new Error("too little text");

  const store = lines[0].replace(/[*]+/g, "").trim();
  const dateMatch = text.match(/\d{4}-\d{2}-\d{2}/);
  const currMatch = text.match(/\b(TWD|USD|EUR|JPY|NTD)\b/);
  const num = (s: string) => {
    const m = s.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/g);
    return m ? parseFloat(m[m.length - 1]) : NaN;
  };

  let total = NaN;
  const items: { name: string; price: number }[] = [];
  for (const line of lines.slice(1)) {
    if (/total/i.test(line)) {
      total = num(line);
      continue;
    }
    if (/thank|date|receipt|tax|subtotal/i.test(line)) continue;
    const price = num(line);
    const name = line.replace(/[\d.,]+\s*$/, "").trim();
    if (!isNaN(price) && name.length >= 2) items.push({ name, price });
  }

  const receipt = {
    store,
    date: dateMatch ? dateMatch[0] : "",
    currency: currMatch ? currMatch[0] : "",
    items,
    total,
  };
  return validateReceipt(receipt); // throws if the read isn't clean enough
}

/**
 * Run OCR on an image (File/Blob/dataURL). `onProgress` gets 0..1 during
 * recognition. Never throws — falls back to the cached receipt on any problem.
 */
export async function ocrReceipt(
  image: File | Blob | string,
  onProgress?: (p: number) => void,
): Promise<OcrResult> {
  let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
  try {
    worker = await withTimeout(
      createWorker("eng", 1, {
        workerPath: "/tesseract/worker.min.js",
        corePath: "/tesseract",
        langPath: "/tesseract",
        logger: (m) => {
          if (m.status === "recognizing text") onProgress?.(m.progress);
        },
      }),
      OCR_TIMEOUT_MS,
    );
    const {
      data: { text },
    } = await withTimeout(worker.recognize(image), OCR_TIMEOUT_MS);
    const receipt = parseReceipt(text);
    return { receipt, source: "ocr", rawText: text };
  } catch {
    return { receipt: CACHED_RECEIPT, source: "cached" };
  } finally {
    if (worker) await worker.terminate().catch(() => {});
  }
}
