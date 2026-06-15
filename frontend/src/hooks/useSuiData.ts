// React hook exposing the SuiData on-chain actions to components.
//
// Builds programmable transaction blocks against the deployed Move package and
// submits them via the connected wallet. Bodies are stubbed where they depend
// on data wiring (Walrus/Seal) that lands in later sessions.

import { useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { MODULE, PACKAGE_ID } from "../lib/network";

export interface ListDatasetArgs {
  identityId: string;
  title: string;
  description: string;
  category: string;
  /** Price in MIST. */
  price: number | bigint;
  walrusBlobId: string;
  sealPolicyId: string;
}

export function useSuiData() {
  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  /** identity::create_identity(kind, name) */
  async function createIdentity(kind: 0 | 1, name: string) {
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE.identity}::create_identity`,
      arguments: [tx.pure.u8(kind), tx.pure.string(name)],
    });
    return signAndExecute({ transaction: tx });
  }

  /** marketplace::list_dataset(...) */
  async function listDataset(args: ListDatasetArgs) {
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE.marketplace}::list_dataset`,
      arguments: [
        tx.object(args.identityId),
        tx.pure.string(args.title),
        tx.pure.string(args.description),
        tx.pure.string(args.category),
        tx.pure.u64(args.price),
        tx.pure.string(args.walrusBlobId),
        tx.pure.string(args.sealPolicyId),
      ],
    });
    return signAndExecute({ transaction: tx });
  }

  /**
   * marketplace::purchase(dataset, payment)
   *
   * TODO: for the MVP `purchase` consumes the whole coin, so split an exact
   * `price` coin from gas before calling. Refine once purchase() returns change.
   */
  async function purchase(datasetId: string, price: number | bigint) {
    const tx = new Transaction();
    const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(price)]);
    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE.marketplace}::purchase`,
      arguments: [tx.object(datasetId), payment],
    });
    return signAndExecute({ transaction: tx });
  }

  return { client, createIdentity, listDataset, purchase };
}
