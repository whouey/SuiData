// Shared network + contract configuration for SuiData.

export const NETWORK = "testnet" as const;

/** Deployed Move package id (testnet). Override via VITE_PACKAGE_ID. */
export const PACKAGE_ID =
  (import.meta.env.VITE_PACKAGE_ID as string | undefined) ??
  "0xc7bc64fe3eb7d93cfcd45949f6816f7a351789aa813e13457a3d1b6d5077cabf";

export const MODULE = {
  identity: "identity",
  marketplace: "marketplace",
} as const;

/** Block explorer base for transaction / object links (testnet). */
export const EXPLORER = "https://suiscan.xyz/testnet";

/** Walrus testnet HTTP endpoints (public publisher + aggregator). */
export const WALRUS = {
  publisher: "https://publisher.walrus-testnet.walrus.space",
  aggregator: "https://aggregator.walrus-testnet.walrus.space",
} as const;
