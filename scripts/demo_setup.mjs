// demo:setup — leave the system in a known-good, listable state for the stage.
//
// Idempotent. Steps:
//   1. confirm the Move package is deployed
//   2. seller wallet present + funded (from env SELLER_PRIVATE_KEY)
//   3. agent wallet present + funded (generated + persisted, topped up by seller)
//   4. seller + agent Identities exist
//   5. seller publishes a receipt dataset (OCR -> encrypt -> Walrus -> list),
//      caching ciphertext + plaintext for the agent's offline fallbacks
//
//   SELLER_PRIVATE_KEY=suiprivkey... npm run demo:setup

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  CFG, client, say, note, withTimeout, exec, createdId, Transaction,
  sellerKeypair, ensureAgentKeypair, suiBalance, fmtSui, MIST,
  sealEncrypt, newPolicyId, walrusUpload, writeState, CACHE,
  explorerAddr, explorerObj,
} from "./lib/common.mjs";
import { getReceiptData, toDataset } from "./ocr.mjs";

const AGENT_FUNDING = MIST / 5n; // 0.2 SUI top-up target for the agent
const PRICE = MIST / 20n; // 0.05 SUI listing price

async function confirmPackage() {
  const o = await withTimeout(
    client.getObject({ id: CFG.packageId, options: { showType: true } }),
    20000,
    "package check",
  );
  if (!o.data) throw new Error(`package ${CFG.packageId} not found on testnet`);
  say(`✓ package deployed: ${CFG.packageId}`);
}

async function ensureIdentity(kp, name, kind) {
  const owned = await withTimeout(
    client.getOwnedObjects({
      owner: kp.toSuiAddress(),
      filter: { StructType: `${CFG.packageId}::identity::Identity` },
    }),
    20000,
    "identity check",
  );
  const existing = owned.data?.[0]?.data?.objectId;
  if (existing) return existing;
  const tx = new Transaction();
  tx.moveCall({
    target: `${CFG.packageId}::identity::create_identity`,
    arguments: [tx.pure.u8(kind), tx.pure.string(name)],
  });
  return createdId(await exec(kp, tx, "create_identity"), "::identity::Identity");
}

async function fundAgent(seller, agentAddr) {
  const bal = await suiBalance(agentAddr);
  if (bal >= AGENT_FUNDING) {
    say(`✓ agent funded: ${fmtSui(bal)} SUI`);
    return;
  }
  const top = AGENT_FUNDING - bal;
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(top)]);
  tx.transferObjects([coin], tx.pure.address(agentAddr));
  await exec(seller, tx, "fund agent");
  say(`✓ agent topped up to ~${fmtSui(AGENT_FUNDING)} SUI`);
}

async function sellerPublish(seller, identityId) {
  // OCR (cached on stage unless ANTHROPIC_API_KEY is set) -> dataset shape.
  const { data: receipt, source } = await getReceiptData();
  say(`✓ OCR (${source}): ${receipt.store}, total ${receipt.total} ${receipt.currency}`);
  const ds = toDataset(receipt);

  const plaintext = new TextEncoder().encode(JSON.stringify(ds.payload));
  const policy = newPolicyId();
  const ciphertext = await sealEncrypt(policy.hex, plaintext);
  say(`✓ encrypted (${ciphertext.length} bytes) under policy ${policy.hex.slice(0, 10)}…`);

  const blobId = await walrusUpload(ciphertext);
  say(`✓ uploaded to Walrus: ${blobId}`);

  const tx = new Transaction();
  tx.moveCall({
    target: `${CFG.packageId}::marketplace::list_dataset`,
    arguments: [
      tx.object(identityId),
      tx.pure.string(ds.title),
      tx.pure.string(ds.description),
      tx.pure.string(ds.category),
      tx.pure.string(ds.preview),
      tx.pure.u64(PRICE),
      tx.pure.string(blobId),
      tx.pure.vector("u8", Array.from(policy.bytes)),
    ],
  });
  const datasetId = createdId(await exec(seller, tx, "list_dataset"), "::marketplace::Dataset");
  say(`✓ listed dataset: ${datasetId}`);

  // Cache for the agent's offline fallbacks.
  writeFileSync(join(CACHE, "ciphertext.bin"), Buffer.from(ciphertext));
  writeFileSync(join(CACHE, "plaintext.json"), Buffer.from(plaintext));
  writeState({
    datasetId,
    blobId,
    policyHex: policy.hex,
    price: PRICE.toString(),
    sellerAddr: seller.toSuiAddress(),
  });
  return datasetId;
}

async function main() {
  say("— OtterProof demo:setup —");
  await confirmPackage();

  const seller = sellerKeypair();
  const sBal = await suiBalance(seller.toSuiAddress());
  say(`✓ seller: ${seller.toSuiAddress()} (${fmtSui(sBal)} SUI)`);
  if (sBal < MIST / 2n)
    throw new Error("seller balance low — fund via https://faucet.sui.io");

  const agent = ensureAgentKeypair();
  await fundAgent(seller, agent.toSuiAddress());

  const sellerId = await ensureIdentity(seller, "Daylight Coffee (seller)", 0);
  say(`✓ seller identity: ${sellerId}`);
  const agentId = await ensureIdentity(agent, "procurement-agent", 1);
  say(`✓ agent identity: ${agentId}`);
  writeState({ agentAddr: agent.toSuiAddress(), agentId, sellerId });

  const datasetId = await sellerPublish(seller, sellerId);

  say("\nReady. Known-good state:");
  say(`  seller   ${explorerAddr(seller.toSuiAddress())}`);
  say(`  agent    ${agent.toSuiAddress()}  (${fmtSui(await suiBalance(agent.toSuiAddress()))} SUI)`);
  say(`  dataset  ${explorerObj(datasetId)}`);

  // Expose the phone seller app over HTTPS (camera needs a secure context).
  if (process.env.SKIP_TUNNEL) {
    say("\n(SKIP_TUNNEL set — skipping HTTPS tunnel.)");
    say("Next:  npm run agent");
    return;
  }
  const port = Number(process.env.VITE_PORT || 5173);
  say(`\nStarting HTTPS tunnel to the seller app on :${port} …`);
  try {
    const { startTunnel } = await import("./lib/tunnel.mjs");
    await startTunnel(port); // prints HTTPS URL + QR, then stays alive
    say("Laptop terminal 2:  npm run agent");
  } catch (e) {
    note(`tunnel unavailable (${e.message})`);
    say("Fallback: deploy the frontend to Vercel (see DEMO_RUNBOOK.md), or run");
    say("  npx localtunnel --port " + port + "   /   cloudflared tunnel --url http://localhost:" + port);
  }
}

main().catch((e) => {
  note(`setup failed: ${e.stack || e.message}`);
  process.exit(1);
});
