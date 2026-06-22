// zkLogin sign-in screen. Shows ONLY the Enoki Google wallet — the browser
// extension path is intentionally excluded (phones have no extensions).

import { useConnectWallet, useWallets } from "@mysten/dapp-kit";
import { isGoogleWallet } from "@mysten/enoki";
import { useState } from "react";
import { zkLoginConfigured } from "../auth/enoki";

export function Login() {
  const wallets = useWallets();
  const googleWallet = wallets.find(isGoogleWallet);
  const { mutate: connect, isPending } = useConnectWallet();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="screen screen--center">
      <div className="brand">
        <div className="brand__logo">◈</div>
        <h1>Cuttle</h1>
        <p className="tagline">The verified data marketplace for the agent economy</p>
        <p className="muted tiny">Turn a receipt into a dataset agents pay for.</p>
      </div>

      {googleWallet ? (
        <button
          className="btn btn--lg btn--google"
          disabled={isPending}
          onClick={() =>
            connect(
              { wallet: googleWallet },
              { onError: (e) => setError(e.message) },
            )
          }
        >
          <span className="g">G</span>
          {isPending ? "Signing in…" : "Sign in with Google"}
        </button>
      ) : (
        <div className="notice">
          {zkLoginConfigured
            ? "Loading sign-in…"
            : "zkLogin not configured. Set VITE_ENOKI_API_KEY and VITE_GOOGLE_CLIENT_ID — see DEMO_RUNBOOK.md."}
        </div>
      )}

      <p className="muted tiny">No wallet, no seed phrase, no gas. ✨</p>
      {error && <p className="err">{error}</p>}
    </div>
  );
}
