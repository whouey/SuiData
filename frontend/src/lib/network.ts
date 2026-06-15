// Shared network + contract configuration for SuiData.
//
// TODO: fill in PACKAGE_ID after `sui client publish` (see scripts/publish.sh),
// then surface it via an env var (e.g. VITE_PACKAGE_ID).

export const NETWORK = "testnet" as const;

/** Deployed Move package id. Placeholder until the package is published. */
export const PACKAGE_ID =
  (import.meta.env.VITE_PACKAGE_ID as string | undefined) ?? "0x0";

export const MODULE = {
  identity: "identity",
  marketplace: "marketplace",
} as const;

/** Walrus testnet endpoints (placeholders — confirm before the demo). */
export const WALRUS = {
  publisher: "https://publisher.walrus-testnet.walrus.space",
  aggregator: "https://aggregator.walrus-testnet.walrus.space",
} as const;
