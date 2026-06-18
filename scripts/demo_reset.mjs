// demo:reset — clear the prepared listing + cached fallbacks so the next
// `demo:setup` publishes a FRESH dataset (sales_count back to 0 for a clean
// on-stage tick-up). Keeps the generated agent wallet + identities so we don't
// re-fund every run.
//
//   npm run demo:reset && npm run demo:setup

import { rmSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CACHE, readState, say } from "./lib/common.mjs";

for (const f of ["ciphertext.bin", "plaintext.json"]) {
  const p = join(CACHE, f);
  if (existsSync(p)) rmSync(p);
}

// Keep wallet + identities; drop only the listing-related keys.
const s = readState();
for (const k of ["datasetId", "blobId", "policyHex", "price"]) delete s[k];
writeFileSync(join(CACHE, "state.json"), JSON.stringify(s, null, 2));

say("✓ reset: cleared listing + fallback caches (wallet + identities kept).");
say("Next:  npm run demo:setup");
