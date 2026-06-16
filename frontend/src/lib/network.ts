// Shared network + contract configuration for SuiData.

export const NETWORK = "testnet" as const;

/** Deployed Move package id (testnet). Override via VITE_PACKAGE_ID. */
export const PACKAGE_ID =
  (import.meta.env.VITE_PACKAGE_ID as string | undefined) ??
  "0x3351d2f8ea2a62ed8ee75d7403a20d5dc4b47542a33e51bd2e3dfe8acddffdc1";

export const MODULE = {
  identity: "identity",
  marketplace: "marketplace",
} as const;

/** Walrus testnet HTTP endpoints (public publisher + aggregator). */
export const WALRUS = {
  publisher: "https://publisher.walrus-testnet.walrus.space",
  aggregator: "https://aggregator.walrus-testnet.walrus.space",
} as const;
