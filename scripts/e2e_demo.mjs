// Headless end-to-end test of the SuiData demo loop against real testnet.
//
// Exercises the same path the UI does, minus the browser wallet: encrypt (Seal)
// -> upload (Walrus) -> list_dataset -> purchase -> seal_approve -> decrypt, and
// asserts the round-tripped plaintext matches. Also asserts a NON-buyer cannot
// decrypt.
//
//   SUI_PRIVATE_KEY=suiprivkey... node scripts/e2e_demo.mjs
import {
  SuiJsonRpcClient,
  getJsonRpcFullnodeUrl,
} from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { fromHex, toHex } from "@mysten/sui/utils";
import { SealClient, SessionKey } from "@mysten/seal";

const PACKAGE_ID =
  "0x52f348bce82689a8145279794ee705f829cdd47a8330e68fb8318140e6bb0914";
const KEY_SERVER =
  "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75";
const KEY_SERVER_URL = "https://seal-key-server-testnet-1.mystenlabs.com";
const WALRUS_PUB = "https://publisher.walrus-testnet.walrus.space";
const WALRUS_AGG = "https://aggregator.walrus-testnet.walrus.space";
const THRESHOLD = 1;

const SECRET = process.env.SUI_PRIVATE_KEY;
if (!SECRET) throw new Error("set SUI_PRIVATE_KEY");

const kp = Ed25519Keypair.fromSecretKey(SECRET);
const addr = kp.toSuiAddress();
const client = new SuiJsonRpcClient({
  url: getJsonRpcFullnodeUrl("testnet"),
  network: "testnet",
});
const seal = new SealClient({
  suiClient: client,
  serverConfigs: [{ objectId: KEY_SERVER, url: KEY_SERVER_URL, weight: 1 }],
  verifyKeyServers: false,
});

const log = (...a) => console.log(...a);
const PLAINTEXT = "FINDING: 73% of agents would pay for verified market data.";

async function exec(tx) {
  const r = await client.signAndExecuteTransaction({
    signer: kp,
    transaction: tx,
    options: { showObjectChanges: true, showEffects: true },
  });
  await client.waitForTransaction({ digest: r.digest });
  if (r.effects?.status?.status !== "success")
    throw new Error("tx failed: " + JSON.stringify(r.effects?.status));
  return r;
}
const created = (r, suffix) =>
  r.objectChanges.find(
    (c) => c.type === "created" && c.objectType.endsWith(suffix),
  )?.objectId;

log(`addr: ${addr}`);

// 0. Ensure an Identity exists (reuse or create).
let identityId;
{
  const owned = await client.getOwnedObjects({
    owner: addr,
    filter: { StructType: `${PACKAGE_ID}::identity::Identity` },
  });
  identityId = owned.data[0]?.data?.objectId;
  if (!identityId) {
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::identity::create_identity`,
      arguments: [tx.pure.u8(1), tx.pure.string("e2e-agent")],
    });
    identityId = created(await exec(tx), "::identity::Identity");
  }
  log(`identity: ${identityId}`);
}

// 1. Encrypt under a fresh policy id.
const policyBytes = crypto.getRandomValues(new Uint8Array(32));
const policyHex = toHex(policyBytes);
const { encryptedObject: ciphertext } = await seal.encrypt({
  threshold: THRESHOLD,
  packageId: PACKAGE_ID,
  id: policyHex,
  data: new TextEncoder().encode(PLAINTEXT),
});
log(`encrypted: ${ciphertext.length} bytes (policy ${policyHex.slice(0, 12)}…)`);

// 2. Upload ciphertext to Walrus.
const up = await fetch(`${WALRUS_PUB}/v1/blobs?epochs=2`, {
  method: "PUT",
  body: ciphertext,
});
const upJson = await up.json();
const blobId =
  upJson.newlyCreated?.blobObject.blobId ?? upJson.alreadyCertified?.blobId;
log(`walrus blobId: ${blobId}`);

// 3. list_dataset with the policy id bytes.
let datasetId;
{
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::marketplace::list_dataset`,
    arguments: [
      tx.object(identityId),
      tx.pure.string("E2E Survey"),
      tx.pure.string("headless test"),
      tx.pure.string("market-survey"),
      tx.pure.string("preview: 3 sample rows, n=1200"),
      tx.pure.u64(10_000_000),
      tx.pure.string(blobId),
      tx.pure.vector("u8", Array.from(policyBytes)),
    ],
  });
  datasetId = created(await exec(tx), "::marketplace::Dataset");
  log(`dataset: ${datasetId}`);
}

// 4. purchase -> AccessGrant.
let grantId;
{
  const tx = new Transaction();
  const [pay] = tx.splitCoins(tx.gas, [tx.pure.u64(10_000_000)]);
  tx.moveCall({
    target: `${PACKAGE_ID}::marketplace::purchase`,
    arguments: [tx.object(datasetId), pay],
  });
  grantId = created(await exec(tx), "::marketplace::AccessGrant");
  log(`grant: ${grantId}`);
}

// 5. SessionKey + seal_approve PTB + decrypt.
async function decryptWith(grant) {
  const sk = await SessionKey.create({
    address: addr,
    packageId: PACKAGE_ID,
    ttlMin: 10,
    suiClient: client,
  });
  const { signature } = await kp.signPersonalMessage(sk.getPersonalMessage());
  await sk.setPersonalMessageSignature(signature);

  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::marketplace::seal_approve`,
    arguments: [
      tx.pure.vector("u8", Array.from(fromHex(policyHex))),
      tx.object(grant),
      tx.object(datasetId),
    ],
  });
  const txBytes = await tx.build({ client, onlyTransactionKind: true });

  const cipher = new Uint8Array(
    await (await fetch(`${WALRUS_AGG}/v1/blobs/${blobId}`)).arrayBuffer(),
  );
  const out = await seal.decrypt({ data: cipher, sessionKey: sk, txBytes });
  return new TextDecoder().decode(out);
}

const recovered = await decryptWith(grantId);
log(`decrypted: "${recovered}"`);
const pass = recovered === PLAINTEXT;
log(`\nmatch: ${pass}`);

// 6. Negative test: a bogus grant must NOT decrypt.
let denied = false;
try {
  await decryptWith("0x0000000000000000000000000000000000000000000000000000000000000000");
} catch {
  denied = true;
}
log(`unauthorized decrypt blocked: ${denied}`);

log(`\nRESULT: ${pass ? "PASS" : "FAIL"}`);
process.exit(pass ? 0 : 1);
