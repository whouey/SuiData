// Server-side Enoki sponsor (PRODUCTION pattern). Holds the Enoki SECRET key —
// runs only on the server, never shipped to the browser. The phone (zkLogin)
// user never holds SUI or sees gas.
//
// Flow:
//   1. frontend builds the transaction kind bytes, POST { action:"create" }
//   2. here: createSponsoredTransaction (secret key) -> { bytes, digest }
//   3. frontend signs `bytes` with the zkLogin wallet, POST { action:"execute" }
//   4. here: executeSponsoredTransaction({ digest, signature })
//
// Required server env (set in Vercel, NOT prefixed VITE_):
//   ENOKI_SECRET_KEY = enoki_private_...
// Optional: SPONSOR_PACKAGE_ID (defaults to the deployed testnet package).

import { EnokiClient } from "@mysten/enoki";

const PACKAGE_ID =
  process.env.SPONSOR_PACKAGE_ID ||
  process.env.VITE_PACKAGE_ID ||
  "0xc7bc64fe3eb7d93cfcd45949f6816f7a351789aa813e13457a3d1b6d5077cabf";

// Only these targets may be sponsored — enforced server-side, never trust client.
const ALLOWED_MOVE_CALL_TARGETS = [
  `${PACKAGE_ID}::identity::create_identity`,
  `${PACKAGE_ID}::marketplace::list_dataset`,
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "POST only" });

  const apiKey = process.env.ENOKI_SECRET_KEY;
  if (!apiKey)
    return res.status(500).json({ error: "ENOKI_SECRET_KEY not configured" });

  const enoki = new EnokiClient({ apiKey });
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

  try {
    if (body.action === "create") {
      const { transactionKindBytes, sender } = body;
      if (!transactionKindBytes || !sender)
        return res.status(400).json({ error: "missing transactionKindBytes/sender" });
      const result = await enoki.createSponsoredTransaction({
        network: "testnet",
        transactionKindBytes,
        sender,
        allowedAddresses: [sender],
        allowedMoveCallTargets: ALLOWED_MOVE_CALL_TARGETS,
      });
      return res.status(200).json(result); // { bytes, digest }
    }

    if (body.action === "execute") {
      const { digest, signature } = body;
      if (!digest || !signature)
        return res.status(400).json({ error: "missing digest/signature" });
      const result = await enoki.executeSponsoredTransaction({ digest, signature });
      return res.status(200).json(result); // { digest }
    }

    return res.status(400).json({ error: "unknown action" });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: message });
  }
}
