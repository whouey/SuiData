// OCR-to-dataset (seller side): a receipt photo -> strict structured JSON.
//
// Live path: a vision-LLM (Anthropic Claude) returns STRICT JSON only, which we
// parse directly. On ANY failure (no key, network, malformed JSON, wrong shape)
// we silently fall back to the cached known-good rehearsal result so the stage
// flow never breaks.
//
//   ANTHROPIC_API_KEY=... node scripts/ocr.mjs [path/to/receipt.png]

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { FIXTURES, withTimeout, note } from "./lib/common.mjs";

const SCHEMA_HINT =
  '{ "store": string, "date": "YYYY-MM-DD", "currency": string, ' +
  '"items": [{ "name": string, "price": number }], "total": number }';

/** Validate the OCR JSON has the shape we require; throws if not. */
function validate(d) {
  if (!d || typeof d !== "object") throw new Error("not an object");
  for (const k of ["store", "date", "currency"])
    if (typeof d[k] !== "string") throw new Error(`bad ${k}`);
  if (!Array.isArray(d.items) || d.items.length === 0)
    throw new Error("bad items");
  for (const it of d.items)
    if (typeof it.name !== "string" || typeof it.price !== "number")
      throw new Error("bad item");
  if (typeof d.total !== "number") throw new Error("bad total");
  return d;
}

function cached() {
  return JSON.parse(readFileSync(join(FIXTURES, "receipt.json"), "utf8"));
}

/** Call the vision LLM and return parsed+validated JSON. Throws on any issue. */
async function liveOcr(imagePath) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("no ANTHROPIC_API_KEY");
  if (!existsSync(imagePath)) throw new Error(`no image at ${imagePath}`);

  const base = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";
  const model = process.env.OCR_MODEL || "claude-sonnet-4-6";
  const b64 = readFileSync(imagePath).toString("base64");

  const res = await withTimeout(
    fetch(`${base}/v1/messages`, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system:
          "You extract receipt data. Respond with STRICT JSON ONLY matching " +
          `this shape: ${SCHEMA_HINT}. No prose, no markdown fences. ` +
          "Numbers must be plain numbers (no currency symbols).",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: "image/png", data: b64 },
              },
              { type: "text", text: "Extract this receipt as JSON." },
            ],
          },
        ],
      }),
    }),
    30000,
    "anthropic ocr",
  );
  if (!res.ok) throw new Error(`anthropic ${res.status}`);
  const j = await res.json();
  let text = (j.content?.[0]?.text ?? "").trim();
  // Defensive: strip accidental ```json fences before parsing.
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  return validate(JSON.parse(text)); // direct parse, caller catches
}

/** Returns { data, source: "live" | "cached" }. Never throws. */
export async function getReceiptData(imagePath = join(FIXTURES, "receipt.png")) {
  try {
    const data = await liveOcr(imagePath);
    return { data, source: "live" };
  } catch (e) {
    note(`OCR live path unavailable (${e.message}); using cached receipt`);
    return { data: cached(), source: "cached" };
  }
}

/**
 * Shape the receipt into the dataset payload that gets encrypted + sold.
 * Includes a public, non-sensitive preview the marketplace can show pre-purchase.
 */
export function toDataset(receipt) {
  const itemCount = receipt.items.length;
  return {
    title: `Receipt · ${receipt.store}`,
    description: `Itemized purchase from ${receipt.store} on ${receipt.date}.`,
    category: "receipt",
    preview: `${itemCount} items · total ${receipt.total} ${receipt.currency} · full itemization unlocked on purchase`,
    payload: receipt, // the encrypted contents
  };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const { data, source } = await getReceiptData(process.argv[2]);
  console.log(JSON.stringify(data, null, 2));
  note(`source: ${source}`);
}
