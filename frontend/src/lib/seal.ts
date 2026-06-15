// Seal client-side encryption + decryption.
//
// Design (see CLAUDE.md): encrypt the dataset client-side BEFORE uploading the
// ciphertext to Walrus. Decryption is gated on-chain by the Seal policy
// "caller holds an AccessGrant for this dataset" — so only a buyer who called
// marketplace::purchase can obtain the keys to decrypt.

import { SealClient } from "@mysten/seal";
import type { SealCompatibleClient } from "@mysten/seal";
import { PACKAGE_ID } from "./network";

/**
 * Build a Seal client bound to the configured key servers.
 *
 * TODO: pin the actual testnet key-server object ids before the demo. The empty
 * list here keeps the module importable/buildable but encrypt/decrypt will fail
 * until configured.
 */
export function makeSealClient(suiClient: SealCompatibleClient): SealClient {
  return new SealClient({
    suiClient,
    serverConfigs: [], // TODO: testnet Seal key servers
    verifyKeyServers: false,
  });
}

/**
 * Encrypt dataset bytes so that only holders of an AccessGrant for `datasetId`
 * can later decrypt. Returns the ciphertext to hand to Walrus.
 *
 * TODO: implement using SealClient.encrypt with an identity/policy derived from
 * the dataset id + marketplace package. Stubbed for the scaffold.
 */
export async function encryptDataset(
  _client: SealClient,
  _datasetId: string,
  _plaintext: Uint8Array,
): Promise<Uint8Array> {
  throw new Error("TODO: implement Seal encryption (encryptDataset)");
}

/**
 * Decrypt dataset bytes. The on-chain Seal policy verifies the caller holds an
 * AccessGrant for the dataset before releasing keys.
 *
 * TODO: implement using SealClient.decrypt with a SessionKey and a PTB that
 * proves AccessGrant ownership (the seal_approve* entry on-chain).
 */
export async function decryptDataset(
  _client: SealClient,
  _datasetId: string,
  _ciphertext: Uint8Array,
): Promise<Uint8Array> {
  throw new Error("TODO: implement Seal decryption (decryptDataset)");
}

// Re-export so callers don't need to know the package wiring detail yet.
export const SEAL_POLICY_PACKAGE = PACKAGE_ID;
