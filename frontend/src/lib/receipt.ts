// Receipt shape + the cached known-good result (the pre-tested demo receipt).
//
// Capture on stage is theater; this validated data is what actually gets
// encrypted + listed, so a slow/garbled OCR read can silently fall back to it.
// Keep in sync with scripts/fixtures/receipt.json.

export interface ReceiptItem {
  name: string;
  price: number;
}
export interface Receipt {
  store: string;
  date: string;
  currency: string;
  items: ReceiptItem[];
  total: number;
}

export const CACHED_RECEIPT: Receipt = {
  store: "Daylight Coffee Roasters",
  date: "2026-06-12",
  currency: "TWD",
  items: [
    { name: "Pour-over (Ethiopia)", price: 180 },
    { name: "Almond croissant", price: 95 },
    { name: "Cold brew 500ml", price: 130 },
  ],
  total: 405,
};

/** Validate OCR output has the shape we require; throws if not. */
export function validateReceipt(d: unknown): Receipt {
  const r = d as Receipt;
  if (!r || typeof r !== "object") throw new Error("not an object");
  for (const k of ["store", "date", "currency"] as const)
    if (typeof r[k] !== "string") throw new Error(`bad ${k}`);
  if (!Array.isArray(r.items) || r.items.length === 0)
    throw new Error("bad items");
  for (const it of r.items)
    if (typeof it.name !== "string" || typeof it.price !== "number")
      throw new Error("bad item");
  if (typeof r.total !== "number") throw new Error("bad total");
  return r;
}

export interface DatasetShape {
  title: string;
  description: string;
  category: string;
  preview: string;
  payload: Receipt;
}

/** Shape a receipt into the listing's metadata + encrypted payload. */
export function toDataset(receipt: Receipt): DatasetShape {
  return {
    title: `Receipt · ${receipt.store}`,
    description: `Itemized purchase from ${receipt.store} on ${receipt.date}.`,
    category: "receipt",
    preview: `${receipt.items.length} items · total ${receipt.total} ${receipt.currency} · full itemization unlocked on purchase`,
    payload: receipt,
  };
}
