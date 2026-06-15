// Scripted demo: create an Agent identity and list a market-survey dataset.
//
// This mirrors the publisher half of the demo flow without the UI, so we can
// smoke-test the contracts end-to-end from a terminal.
//
// Run (after publishing the package and setting env vars):
//   PACKAGE_ID=0x... SUI_PRIVATE_KEY=suiprivkey... npx tsx scripts/demo_publish.ts
//
// TODO: implement once the package is published. Outline:
//   1. Load keypair from SUI_PRIVATE_KEY, build a SuiClient (testnet).
//   2. create_identity(Agent, "demo-agent") -> capture the Identity object id.
//   3. Encrypt a sample survey (Seal) -> upload ciphertext to Walrus -> blobId.
//   4. list_dataset(identity, ...metadata..., blobId, policyId).
//   5. Print the shared Dataset object id for the buyer-side demo.

async function main() {
  throw new Error("TODO: implement demo_publish once PACKAGE_ID is set");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
