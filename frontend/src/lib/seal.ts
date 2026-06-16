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
import { fromHex } from "@mysten/sui/utils";
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

/** The Seal identity (hex, no 0x) for a dataset = its object id bytes. */
function datasetIdentity(datasetId: string): string {
  return datasetId.startsWith("0x") ? datasetId.slice(2) : datasetId;
}

/**
 * Encrypt dataset bytes so only holders of an AccessGrant for `datasetId` can
 * later decrypt. Returns the ciphertext to hand to Walrus.
 */
export async function encryptDataset(
  client: SealClient,
  datasetId: string,
  plaintext: Uint8Array,
): Promise<Uint8Array> {
  const { encryptedObject } = await client.encrypt({
    threshold: THRESHOLD,
    packageId: PACKAGE_ID,
    id: datasetIdentity(datasetId),
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
  datasetId: string,
  accessGrantId: string,
): Promise<Uint8Array> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE.marketplace}::seal_approve`,
    arguments: [
      tx.pure.vector("u8", Array.from(fromHex(datasetIdentity(datasetId)))),
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
