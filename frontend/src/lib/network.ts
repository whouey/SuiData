// Shared network + contract configuration for SuiData.
//
// TODO: fill in PACKAGE_ID after `sui client publish` (see scripts/publish.sh),
// then surface it via an env var (e.g. VITE_PACKAGE_ID).

export const NETWORK = "testnet" as const;

/** Deployed Move package id (testnet). Override via VITE_PACKAGE_ID. */
export const PACKAGE_ID =
  (import.meta.env.VITE_PACKAGE_ID as string | undefined) ??
  "0xee8470ddf3958217976cf1e02a3660311dba329625cc23ca068539d6f5df3f22";

export const MODULE = {
  identity: "identity",
  marketplace: "marketplace",
} as const;

/** Walrus testnet endpoints (placeholders — confirm before the demo). */
export const WALRUS = {
  publisher: "https://publisher.walrus-testnet.walrus.space",
  aggregator: "https://aggregator.walrus-testnet.walrus.space",
} as const;
