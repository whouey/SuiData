// React hooks exposing SuiData's on-chain actions + reads to components.
//
// Mutations build programmable transaction blocks against the deployed Move
// package and submit them via the connected wallet. Reads use react-query.

import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
  useSuiClientQuery,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useQuery } from "@tanstack/react-query";
import { MODULE, PACKAGE_ID } from "../lib/network";

export interface ListDatasetArgs {
  identityId: string;
  title: string;
  description: string;
  category: string;
  /** Public, unencrypted teaser shown before purchase. */
  preview: string;
  /** Price in MIST. */
  price: number | bigint;
  walrusBlobId: string;
  /** Seal policy id bytes — stored on-chain as vector<u8>. */
  sealPolicyId: Uint8Array;
}

export interface Dataset {
  id: string;
  publisher: string;
  title: string;
  description: string;
  category: string;
  preview: string;
  /** Price in MIST. */
  price: bigint;
  walrusBlobId: string;
  /** Seal policy id (hex, no 0x) the payload was encrypted under. */
  sealPolicyIdHex: string;
  /** On-chain purchase count for this dataset. */
  salesCount: number;
  /** Seller reputation (derived): total datasets this publisher has listed. */
  sellerDatasetsPublished: number;
  /** Seller reputation (derived): total sales across this publisher's datasets. */
  sellerSales: number;
}

export interface Identity {
  id: string;
  kind: number;
  displayName: string;
}

// === Mutations ===

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
        tx.pure.string(args.preview),
        tx.pure.u64(args.price),
        tx.pure.string(args.walrusBlobId),
        tx.pure.vector("u8", Array.from(args.sealPolicyId)),
      ],
    });
    return signAndExecute({ transaction: tx });
  }

  /**
   * marketplace::purchase(dataset, payment). `purchase` returns change, so we
   * just split the exact `price` off gas for the payment coin.
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

// === Reads ===

/** Bytes-or-base64 vector<u8> from RPC -> hex string (no 0x). */
function vecU8ToHex(v: unknown): string {
  let bytes: Uint8Array;
  if (Array.isArray(v)) {
    bytes = Uint8Array.from(v as number[]);
  } else if (typeof v === "string") {
    // RPC may return a base64 string for vector<u8>.
    bytes = Uint8Array.from(atob(v), (c) => c.charCodeAt(0));
  } else {
    return "";
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Identities owned by the connected wallet. */
export function useOwnedIdentities() {
  const account = useCurrentAccount();
  return useSuiClientQuery(
    "getOwnedObjects",
    {
      owner: account?.address ?? "",
      filter: { StructType: `${PACKAGE_ID}::${MODULE.identity}::Identity` },
      options: { showContent: true },
    },
    {
      enabled: !!account,
      select: (data): Identity[] =>
        data.data.flatMap((o) => {
          const c = o.data?.content;
          if (!c || c.dataType !== "moveObject") return [];
          const f = c.fields as Record<string, unknown>;
          return [
            {
              id: o.data!.objectId,
              kind: Number(f.kind),
              displayName: String(f.display_name),
            },
          ];
        }),
    },
  );
}

/** AccessGrants owned by the connected wallet, keyed by dataset id. */
export function useOwnedGrants() {
  const account = useCurrentAccount();
  return useSuiClientQuery(
    "getOwnedObjects",
    {
      owner: account?.address ?? "",
      filter: {
        StructType: `${PACKAGE_ID}::${MODULE.marketplace}::AccessGrant`,
      },
      options: { showContent: true },
    },
    {
      enabled: !!account,
      select: (data): Record<string, string> => {
        const map: Record<string, string> = {};
        for (const o of data.data) {
          const c = o.data?.content;
          if (!c || c.dataType !== "moveObject") continue;
          const f = c.fields as Record<string, unknown>;
          map[String(f.dataset_id)] = o.data!.objectId;
        }
        return map;
      },
    },
  );
}

/** All listed datasets (via DatasetListed events, then object fetch). */
export function useDatasets() {
  const client = useSuiClient();
  return useQuery({
    queryKey: ["datasets", PACKAGE_ID],
    queryFn: async (): Promise<Dataset[]> => {
      const events = await client.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::${MODULE.marketplace}::DatasetListed`,
        },
        order: "descending",
        limit: 50,
      });
      const ids = events.data
        .map((e) => (e.parsedJson as { dataset_id?: string })?.dataset_id)
        .filter((id): id is string => !!id);
      if (ids.length === 0) return [];

      const objs = await client.multiGetObjects({
        ids,
        options: { showContent: true },
      });
      const datasets = objs.flatMap((o) => {
        const c = o.data?.content;
        if (!c || c.dataType !== "moveObject") return [];
        const f = c.fields as Record<string, unknown>;
        return [
          {
            id: o.data!.objectId,
            publisher: String(f.publisher),
            title: String(f.title),
            description: String(f.description),
            category: String(f.category),
            preview: String(f.preview ?? ""),
            price: BigInt(String(f.price)),
            walrusBlobId: String(f.walrus_blob_id),
            sealPolicyIdHex: vecU8ToHex(f.seal_policy_id),
            salesCount: Number(f.sales_count ?? 0),
            sellerDatasetsPublished: 0,
            sellerSales: 0,
          },
        ];
      });

      // Derive per-seller reputation from the fetched listings.
      const byPublisher: Record<string, { count: number; sales: number }> = {};
      for (const d of datasets) {
        const agg = (byPublisher[d.publisher] ??= { count: 0, sales: 0 });
        agg.count += 1;
        agg.sales += d.salesCount;
      }
      for (const d of datasets) {
        d.sellerDatasetsPublished = byPublisher[d.publisher].count;
        d.sellerSales = byPublisher[d.publisher].sales;
      }
      return datasets;
    },
  });
}
