// agent.mjs — the autonomous buyer. NO human in the loop.
//
// Finds a listing, pays SUI from its own wallet, receives an AccessGrant,
// fetches the ciphertext from Walrus, decrypts via Seal, and makes a decision.
// Every step prints one narratable line. Every network op is timeout-wrapped and
// has a cached fallback, and a global watchdog guarantees the script never hangs.
//
//   npm run agent

import { join } from "node:path";
import {
  CFG, client, say, note, withTimeout, exec, createdId, Transaction,
  agentKeypair, getDataset, latestDatasetId, readState, suiBalance, fmtSui,
  walrusDownload, sealDecrypt, CACHE, explorerTx,
} from "./lib/common.mjs";

// Global watchdog: hard-exit if the whole run exceeds this.
const watchdog = setTimeout(() => {
  note("watchdog: exceeded 150s, aborting");
  process.exit(2);
}, 150000);

function decide(receipt) {
  const total = Number(receipt.total) || 0;
  const cur = receipt.currency || "";
  if (total <= 1000)
    return `approved — ${total} ${cur} is within per-receipt policy; logged to expense report.`;
  return `flagged for human review — ${total} ${cur} exceeds the auto-approve limit.`;
}

async function main() {
  const agent = agentKeypair();
  const addr = agent.toSuiAddress();
  const st = readState();
  say(`Agent online: ${addr} (identity ${st.agentId ? st.agentId.slice(0, 10) + "…" : "n/a"})`);
  say(`Wallet balance: ${fmtSui(await suiBalance(addr))} SUI`);

  // 1. Find a listing. Prefer the LATEST on-chain listing so the agent buys
  // whatever the phone seller just published; fall back to the setup-prepared id.
  say("Scanning marketplace…");
  let datasetId;
  try {
    datasetId = (await latestDatasetId()) || st.datasetId;
  } catch {
    datasetId = st.datasetId;
  }
  if (!datasetId) throw new Error("no dataset listed — run `npm run demo:setup`");
  const ds = await getDataset(datasetId);
  say(`Found dataset: "${ds.title}" — ${fmtSui(ds.price)} SUI from seller ${ds.publisher.slice(0, 10)}…`);

  // 2. Pay from the agent's own wallet -> AccessGrant.
  say(`Paying ${fmtSui(ds.price)} SUI…`);
  const tx = new Transaction();
  const [pay] = tx.splitCoins(tx.gas, [tx.pure.u64(ds.price)]);
  tx.moveCall({
    target: `${CFG.packageId}::marketplace::purchase`,
    arguments: [tx.object(datasetId), pay],
  });
  const res = await exec(agent, tx, "purchase");
  const grantId = createdId(res, "::marketplace::AccessGrant");
  say(`Received access grant ${grantId.slice(0, 10)}…  (tx ${explorerTx(res.digest)})`);

  const after = await getDataset(datasetId);
  say(`Seller reputation: sales_count now ${after.salesCount}`);

  // 3. Fetch ciphertext from Walrus (cached fallback if the fetch fails).
  say("Fetching from Walrus…");
  const ciphertext = await walrusDownload(ds.walrusBlobId, join(CACHE, "ciphertext.bin"));

  // 4. Decrypt via Seal (cached plaintext fallback if decrypt fails).
  say("Decrypting via Seal…");
  const plainBytes = await sealDecrypt(agent, {
    policyHex: ds.sealPolicyIdHex,
    grantId,
    datasetId,
    ciphertext,
    cachePlaintextFile: join(CACHE, "plaintext.json"),
  });
  const receipt = JSON.parse(new TextDecoder().decode(plainBytes));

  // 5. Use the data + decide.
  const prices = receipt.items.map((i) => `${i.name} ${i.price}`).join(", ");
  say(`Prices: ${prices}`);
  say(`Decision: ${decide(receipt)}`);

  clearTimeout(watchdog);
  say("\n✓ Agent run complete.");
  process.exit(0);
}

main().catch((e) => {
  note(`agent failed: ${e.stack || e.message}`);
  clearTimeout(watchdog);
  process.exit(1);
});
