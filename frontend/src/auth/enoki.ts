// zkLogin (Google) via Enoki — replaces the browser-extension wallet.
//
// Enoki registers a Google "Sign in" as a standard wallet that dapp-kit's hooks
// (useWallets / useConnectWallet / useCurrentAccount / useSignAndExecuteTransaction)
// drive transparently. Enoki also SPONSORS gas, so the zkLogin user never holds
// SUI or sees a gas prompt — required because phones have no wallet extension.
//
// Setup (see DEMO_RUNBOOK.md): create an Enoki app, add a Google OAuth client,
// enable sponsored transactions and allowlist this package's move targets.

import { registerEnokiWallets } from "@mysten/enoki";
import { NETWORK } from "../lib/network";

export const ENOKI_API_KEY = import.meta.env.VITE_ENOKI_API_KEY as
  | string
  | undefined;
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as
  | string
  | undefined;

/** True only when both Enoki + Google OAuth are configured. */
export const zkLoginConfigured = Boolean(ENOKI_API_KEY && GOOGLE_CLIENT_ID);

let registered = false;

/**
 * Register the Enoki Google wallet exactly once. Safe under React StrictMode's
 * double-mount. No-op (returns false) if env isn't configured.
 */
export function registerEnoki(client: unknown): boolean {
  if (registered || !zkLoginConfigured) return registered;
  registerEnokiWallets({
    apiKey: ENOKI_API_KEY!,
    providers: {
      google: {
        clientId: GOOGLE_CLIENT_ID!,
        // Redirect flow is the reliable path on mobile browsers/PWAs.
        redirectUrl: window.location.origin + window.location.pathname,
      },
    },
    client: client as never,
    network: NETWORK,
  });
  registered = true;
  return true;
}
