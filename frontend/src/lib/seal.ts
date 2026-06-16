// Seal client-side encryption + decryption.
//
// Design (see CLAUDE.md): encrypt the dataset client-side BEFORE uploading the
// ciphertext to Walrus. Decryption is gated on-chain by the Seal policy
// `marketplace::seal_approve` — "caller holds an AccessGrant for this dataset" —
// so only a buyer who called marketplace::purchase can obtain the keys.
//
// The Seal encryption identity is the Dataset's object id bytes; that's exactly
// what `seal_approve(id, grant, dataset)` checks on-chain.

import { SealClient, SessionKey } from "@mysten/seal";
import type { SealCompatibleClient } from "@mysten/seal";
import { Transaction } from "@mysten/sui/transactions";
import { fromHex, toHex } from "@mysten/sui/utils";
import { MODULE, NETWORK, PACKAGE_ID } from "./network";

/**
 * Allowlisted Seal key servers per network.
 *
 * `@mysten/seal` shipped a `getAllowlistedKeyServers(network)` helper in 0.4.x
 * but REMOVED it in the 1.x line (which our stack requires). It only ever
 * returned a static list, so we replicate it here. Object ids are confirmed
 * live on-chain via each server's `/v1/service` endpoint.
 *
 * To add Mysten's second testnet server (or swap in your own), append here and
 * bump `THRESHOLD`.
 */
const ALLOWLISTED_KEY_SERVERS: Record<
  "testnet" | "mainnet",
  { objectId: string; url: string }[]
> = {
  testnet: [
    {
      objectId:
        "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
      url: "https://seal-key-server-testnet-1.mystenlabs.com",
    },
  ],
  mainnet: [],
};

/** Drop-in for the removed SDK helper: the allowlisted key servers for `net`. */
export function getAllowlistedKeyServers(net: "testnet" | "mainnet") {
  return ALLOWLISTED_KEY_SERVERS[net];
}

/** Key servers in use. A `THRESHOLD` of these must return shares to decrypt. */
export const KEY_SERVERS = getAllowlistedKeyServers(NETWORK);
export const THRESHOLD = 1;

/** Build a Seal client bound to the configured key servers. */
export function makeSealClient(suiClient: SealCompatibleClient): SealClient {
  return new SealClient({
    suiClient,
    serverConfigs: KEY_SERVERS.map((s) => ({
      objectId: s.objectId,
      url: s.url,
      weight: 1,
    })),
    verifyKeyServers: false,
  });
}

/** Strip a leading 0x so a value is a bare hex string. */
function bareHex(id: string): string {
  return id.startsWith("0x") ? id.slice(2) : id;
}

/**
 * A per-dataset Seal identity ("policy id"). Generated client-side BEFORE the
 * dataset object exists; the same bytes get stored on-chain as the Dataset's
 * `seal_policy_id`, and `seal_approve` checks the requested id against it.
 */
export interface PolicyId {
  /** Hex (no 0x) — pass to encrypt/decrypt. */
  hex: string;
  /** Raw bytes — store on-chain as `seal_policy_id` (vector<u8>). */
  bytes: Uint8Array;
}

/** Generate a fresh random 32-byte policy id. */
export function generatePolicyId(): PolicyId {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return { hex: toHex(bytes), bytes };
}

/**
 * Encrypt dataset bytes under `policyIdHex` so only holders of an AccessGrant
 * for the matching dataset can later decrypt. Returns ciphertext for Walrus.
 */
export async function encryptDataset(
  client: SealClient,
  policyIdHex: string,
  plaintext: Uint8Array,
): Promise<Uint8Array> {
  const { encryptedObject } = await client.encrypt({
    threshold: THRESHOLD,
    packageId: PACKAGE_ID,
    id: bareHex(policyIdHex),
    data: plaintext,
  });
  return encryptedObject;
}

/**
 * Build the `seal_approve` PTB the key servers dry-run to authorize decryption.
 * Returns transaction-kind bytes (no gas/sender), as Seal expects.
 */
export async function buildApproveTxBytes(
  client: SealCompatibleClient,
  policyIdHex: string,
  accessGrantId: string,
  datasetId: string,
): Promise<Uint8Array> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE.marketplace}::seal_approve`,
    arguments: [
      tx.pure.vector("u8", Array.from(fromHex(bareHex(policyIdHex)))),
      tx.object(accessGrantId),
      tx.object(datasetId),
    ],
  });
  return tx.build({ client, onlyTransactionKind: true });
}

/**
 * Decrypt dataset bytes. `sessionKey` must be created + signed by the buyer's
 * wallet (see makeSessionKey); the on-chain policy verifies AccessGrant
 * ownership via the `seal_approve` PTB in `txBytes`.
 */
export async function decryptDataset(
  client: SealClient,
  sessionKey: SessionKey,
  txBytes: Uint8Array,
  ciphertext: Uint8Array,
): Promise<Uint8Array> {
  return client.decrypt({ data: ciphertext, sessionKey, txBytes });
}

/**
 * Create a SessionKey for `address` scoped to this package. The caller must
 * sign `sessionKey.getPersonalMessage()` with the wallet and pass it to
 * `setPersonalMessageSignature` before decrypting.
 */
export function makeSessionKey(
  suiClient: SealCompatibleClient,
  address: string,
  ttlMin = 10,
): Promise<SessionKey> {
  return SessionKey.create({
    address,
    packageId: PACKAGE_ID,
    ttlMin,
    suiClient,
  });
}
