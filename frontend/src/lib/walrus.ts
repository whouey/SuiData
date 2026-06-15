// Walrus blob storage helpers.
//
// SuiData stores the ENCRYPTED dataset payload on Walrus and keeps the returned
// blobId on the on-chain Dataset object. Encryption happens in lib/seal.ts
// BEFORE upload — plaintext never leaves the client.

import { WALRUS } from "./network";

/**
 * Upload ciphertext to Walrus and return its blobId.
 *
 * TODO: replace this raw publisher-HTTP stub with the @mysten/walrus SDK
 * (WalrusClient) once wallet-funded WAL handling is wired up. For the MVP demo
 * the HTTP publisher is the simplest path.
 */
export async function uploadBlob(data: Uint8Array): Promise<string> {
  const res = await fetch(`${WALRUS.publisher}/v1/blobs`, {
    method: "PUT",
    body: data as BodyInit,
  });
  if (!res.ok) {
    throw new Error(`Walrus upload failed: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as WalrusPublishResponse;
  // Response shape differs between newly-created and already-certified blobs.
  const blobId =
    json.newlyCreated?.blobObject.blobId ?? json.alreadyCertified?.blobId;
  if (!blobId) throw new Error("Walrus response missing blobId");
  return blobId;
}

/** Download a blob's bytes (still ciphertext — decrypt via lib/seal.ts). */
export async function downloadBlob(blobId: string): Promise<Uint8Array> {
  const res = await fetch(`${WALRUS.aggregator}/v1/blobs/${blobId}`);
  if (!res.ok) {
    throw new Error(`Walrus download failed: ${res.status} ${res.statusText}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

// Minimal shape of the Walrus publisher response we care about.
interface WalrusPublishResponse {
  newlyCreated?: { blobObject: { blobId: string } };
  alreadyCertified?: { blobId: string };
}
