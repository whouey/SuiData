// Shared helpers for the OtterProof demo scripts (OCR seller, agent, setup).
//
// Design goals for a live stage: never hang (everything is timeout-wrapped) and
// never dead-end (network paths have cached fallbacks). Narratable output goes
// to stdout; fallback/diagnostic notes go to stderr so the demo screen stays clean.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  SuiJsonRpcClient,
  getJsonRpcFullnodeUrl,
} from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { fromHex, toHex } from "@mysten/sui/utils";
import { SealClient, SessionKey } from "@mysten/seal";

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, "..", "..");
export const FIXTURES = join(HERE, "..", "fixtures"); // committed, known-good
export const CACHE = join(HERE, "..", ".demo"); // gitignored, runtime state
if (!existsSync(CACHE)) mkdirSync(CACHE, { recursive: true });

// --- config (env overrides, sane testnet defaults) ---
export const CFG = {
  packageId:
    process.env.PACKAGE_ID ||
    "0xc7bc64fe3eb7d93cfcd45949f6816f7a351789aa813e13457a3d1b6d5077cabf",
  keyServer:
    "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
  keyServerUrl: "https://seal-key-server-testnet-1.mystenlabs.com",
  walrusPub: "https://publisher.walrus-testnet.walrus.space",
  walrusAgg: "https://aggregator.walrus-testnet.walrus.space",
  threshold: 1,
  explorer: "https://suiscan.xyz/testnet",
};

export const client = new SuiJsonRpcClient({
  url: getJsonRpcFullnodeUrl("testnet"),
  network: "testnet",
});

export const seal = new SealClient({
  suiClient: client,
  serverConfigs: [
    { objectId: CFG.keyServer, url: CFG.keyServerUrl, weight: 1 },
  ],
  verifyKeyServers: false,
});

// --- tiny output helpers ---
export const say = (...a) => console.log(...a); // stage screen
export const note = (...a) => console.error("  ·", ...a); // diagnostics

export function explorerTx(digest) {
  return `${CFG.explorer}/tx/${digest}`;
}
export function explorerAddr(addr) {
  return `${CFG.explorer}/account/${addr}`;
}
export function explorerObj(id) {
  return `${CFG.explorer}/object/${id}`;
}

// --- reliability primitives ---
export function withTimeout(promise, ms, label) {
  let t;
  const timeout = new Promise((_, rej) => {
    t = setTimeout(() => rej(new Error(`timeout after ${ms}ms: ${label}`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

// --- wallets ---
export function loadKeypair(suiprivkey) {
  return Ed25519Keypair.fromSecretKey(suiprivkey);
}

/** Persisted demo state (agent wallet, last listing) lives in scripts/.demo. */
export function readState() {
  const p = join(CACHE, "state.json");
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {};
}
export function writeState(patch) {
  const next = { ...readState(), ...patch };
  writeFileSync(join(CACHE, "state.json"), JSON.stringify(next, null, 2));
  return next;
}

/** Seller key: from env (presenter supplies). */
export function sellerKeypair() {
  const k = process.env.SELLER_PRIVATE_KEY || process.env.SUI_PRIVATE_KEY;
  if (!k) throw new Error("set SELLER_PRIVATE_KEY (or SUI_PRIVATE_KEY)");
  return loadKeypair(k);
}

/** Agent key: env override, else generated + persisted by demo:setup. */
export function agentKeypair() {
  if (process.env.AGENT_PRIVATE_KEY) return loadKeypair(process.env.AGENT_PRIVATE_KEY);
  const s = readState();
  if (s.agentSecret) return loadKeypair(s.agentSecret);
  throw new Error("no agent wallet — run `npm run demo:setup` first");
}

export function ensureAgentKeypair() {
  if (process.env.AGENT_PRIVATE_KEY) return loadKeypair(process.env.AGENT_PRIVATE_KEY);
  const s = readState();
  if (s.agentSecret) return loadKeypair(s.agentSecret);
  const kp = new Ed25519Keypair();
  writeState({ agentSecret: kp.getSecretKey(), agentAddr: kp.toSuiAddress() });
  return kp;
}

// --- transactions ---
export async function exec(signer, tx, label = "tx") {
  const r = await withTimeout(
    client.signAndExecuteTransaction({
      signer,
      transaction: tx,
      options: { showObjectChanges: true, showEffects: true, showBalanceChanges: true },
    }),
    60000,
    label,
  );
  await withTimeout(client.waitForTransaction({ digest: r.digest }), 60000, `wait ${label}`);
  if (r.effects?.status?.status !== "success")
    throw new Error(`${label} failed: ${JSON.stringify(r.effects?.status)}`);
  return r;
}

export function createdId(r, suffix) {
  return r.objectChanges?.find(
    (c) => c.type === "created" && c.objectType?.endsWith(suffix),
  )?.objectId;
}

// --- balances / reputation reads ---
export async function suiBalance(addr) {
  const b = await withTimeout(
    client.getBalance({ owner: addr }),
    20000,
    "getBalance",
  );
  return BigInt(b.totalBalance);
}

export const MIST = 1_000_000_000n;
export const fmtSui = (mist) => (Number(mist) / 1e9).toFixed(4);

// --- Walrus with timeout + cached fallback ---
export async function walrusUpload(bytes, epochs = 5) {
  const res = await withTimeout(
    fetch(`${CFG.walrusPub}/v1/blobs?epochs=${epochs}`, {
      method: "PUT",
      body: bytes,
    }),
    60000,
    "walrus upload",
  );
  if (!res.ok) throw new Error(`walrus upload ${res.status}`);
  const j = await res.json();
  const blobId = j.newlyCreated?.blobObject.blobId ?? j.alreadyCertified?.blobId;
  if (!blobId) throw new Error("walrus: no blobId");
  return blobId;
}

/** Download a blob; on failure fall back to a cached copy if `cacheFile` exists. */
export async function walrusDownload(blobId, cacheFile) {
  try {
    if (process.env.FORCE_FALLBACK) throw new Error("forced fallback");
    const res = await withTimeout(
      fetch(`${CFG.walrusAgg}/v1/blobs/${blobId}`),
      30000,
      "walrus download",
    );
    if (!res.ok) throw new Error(`walrus download ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  } catch (e) {
    if (cacheFile && existsSync(cacheFile)) {
      note(`Walrus fetch failed (${e.message}); using cached ciphertext`);
      return new Uint8Array(readFileSync(cacheFile));
    }
    throw e;
  }
}

// --- Seal encrypt/decrypt ---
export function newPolicyId() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return { bytes, hex: toHex(bytes) };
}

export async function sealEncrypt(policyHex, plaintext) {
  const { encryptedObject } = await withTimeout(
    seal.encrypt({
      threshold: CFG.threshold,
      packageId: CFG.packageId,
      id: policyHex,
      data: plaintext,
    }),
    60000,
    "seal encrypt",
  );
  return encryptedObject;
}

export async function buildApproveTxBytes(policyHex, grantId, datasetId) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CFG.packageId}::marketplace::seal_approve`,
    arguments: [
      tx.pure.vector("u8", Array.from(fromHex(policyHex))),
      tx.object(grantId),
      tx.object(datasetId),
    ],
  });
  return tx.build({ client, onlyTransactionKind: true });
}

/** Decrypt with timeout; fall back to cached plaintext file on failure. */
export async function sealDecrypt(
  signerKp,
  { policyHex, grantId, datasetId, ciphertext, cachePlaintextFile },
) {
  try {
    if (process.env.FORCE_FALLBACK) throw new Error("forced fallback");
    const sk = await withTimeout(
      SessionKey.create({
        address: signerKp.toSuiAddress(),
        packageId: CFG.packageId,
        ttlMin: 10,
        suiClient: client,
      }),
      20000,
      "session key",
    );
    const { signature } = await signerKp.signPersonalMessage(sk.getPersonalMessage());
    await sk.setPersonalMessageSignature(signature);
    const txBytes = await buildApproveTxBytes(policyHex, grantId, datasetId);
    const out = await withTimeout(
      seal.decrypt({ data: ciphertext, sessionKey: sk, txBytes }),
      40000,
      "seal decrypt",
    );
    return new Uint8Array(out);
  } catch (e) {
    if (cachePlaintextFile && existsSync(cachePlaintextFile)) {
      note(`Seal decrypt failed (${e.message}); using cached plaintext`);
      return new Uint8Array(readFileSync(cachePlaintextFile));
    }
    throw e;
  }
}

// --- dataset reads ---
export function vecU8ToHex(v) {
  let bytes;
  if (Array.isArray(v)) bytes = Uint8Array.from(v);
  else if (typeof v === "string")
    bytes = Uint8Array.from(Buffer.from(v, "base64"));
  else return "";
  return Buffer.from(bytes).toString("hex");
}

/** Fetch and parse a shared Dataset object into a flat JS shape. */
export async function getDataset(datasetId) {
  const o = await withTimeout(
    client.getObject({ id: datasetId, options: { showContent: true } }),
    20000,
    "getDataset",
  );
  const f = o.data?.content?.fields;
  if (!f) throw new Error(`dataset ${datasetId} not found`);
  return {
    id: datasetId,
    publisher: f.publisher,
    title: f.title,
    description: f.description,
    category: f.category,
    preview: f.preview,
    price: BigInt(f.price),
    walrusBlobId: f.walrus_blob_id,
    sealPolicyIdHex: vecU8ToHex(f.seal_policy_id),
    salesCount: Number(f.sales_count ?? 0),
  };
}

/** Most recent listed dataset id (from DatasetListed events). */
export async function latestDatasetId() {
  const ev = await withTimeout(
    client.queryEvents({
      query: { MoveEventType: `${CFG.packageId}::marketplace::DatasetListed` },
      order: "descending",
      limit: 1,
    }),
    20000,
    "queryEvents",
  );
  return ev.data?.[0]?.parsedJson?.dataset_id;
}

export { Transaction, fromHex, toHex, readFileSync, writeFileSync, existsSync, join };
