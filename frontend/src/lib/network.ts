// Shared network + contract configuration for SuiData.

export const NETWORK = "testnet" as const;

/** Deployed Move package id (testnet). Override via VITE_PACKAGE_ID. */
export const PACKAGE_ID =
  (import.meta.env.VITE_PACKAGE_ID as string | undefined) ??
  "0x52f348bce82689a8145279794ee705f829cdd47a8330e68fb8318140e6bb0914";

export const MODULE = {
  identity: "identity",
  marketplace: "marketplace",
} as const;

/** Walrus testnet HTTP endpoints (public publisher + aggregator). */
export const WALRUS = {
  publisher: "https://publisher.walrus-testnet.walrus.space",
  aggregator: "https://aggregator.walrus-testnet.walrus.space",
} as const;
